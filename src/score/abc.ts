import abcjs from 'abcjs'
import type { TuneObject } from 'abcjs'
import {
  FIRST_POSITION_LOWEST_MIDI,
  defaultFingering,
  fingeringWithFinger,
  type Finger,
} from '../music/fingering'
import { noteName } from '../music/pitch'
import type { Exercise, ParseResult, Target } from './exercise'

/** Runtime fields abcjs sets on note elements that its type definitions leave out. */
interface AbcNote {
  el_type: 'note'
  startChar: number
  duration: number
  pitches?: { name: string; pitch: number; endTie?: boolean }[]
  rest?: unknown
  decoration?: string[]
  gracenotes?: unknown[]
  midiPitches?: { pitch: number }[]
}

/** Bar line items; repeats are recognisable by their type or an ending number. */
interface AbcBar {
  el_type: 'bar'
  startChar: number
  type: string
  startEnding?: string
}

const FINGER_DECORATIONS = new Set(['0', '1', '2', '3', '4'])

export function parseExercise(abc: string): ParseResult {
  const tunes = abcjs.parseOnly(abc) as TuneObject[]
  if (tunes.length === 0) {
    return { ok: false, errors: ['No tune found. An exercise needs an X: line and a K: line.'] }
  }
  if (tunes.length > 1) return { ok: false, errors: ['Write only one tune per exercise.'] }
  return exerciseFromTune(tunes[0], abc)
}

/** Builds an exercise from a tune that abcjs has parsed (or rendered). */
export function exerciseFromTune(tune: TuneObject, abc: string): ParseResult {
  const errors = (tune.warnings ?? []).map(stripHtml)
  const warnings: string[] = []
  tune.setUpAudio({})

  const preferFlats = (tune.getKeySignature().accidentals ?? []).some((a) => a.acc === 'flat')
  const targets: Target[] = []
  /** Staff position of the previous note, to check that ties join equal pitches. */
  let previousPitch: number | null = null

  for (const line of tune.lines) {
    if (!line.staff) continue
    if (line.staff.length > 1 || line.staff.some((s) => (s.voices?.length ?? 0) > 1)) {
      errors.push('Only a single melody line is supported (one staff, one voice).')
      break
    }
    for (const item of line.staff[0]?.voices?.[0] ?? []) {
      if (item.el_type === 'bar') {
        const bar = item as unknown as AbcBar
        if (bar.type.includes('repeat') || bar.startEnding) {
          errors.push(
            `Repeat signs and endings are not supported yet; write the music out in full (at character ${bar.startChar}).`,
          )
        }
        continue
      }
      if (item.el_type !== 'note') continue
      const note = item as unknown as AbcNote
      if (note.rest || !note.pitches) continue
      const at = `at character ${note.startChar}`
      if (note.pitches.length > 1) {
        errors.push(`Chords and double stops are not supported yet (${at}).`)
        continue
      }
      if (note.gracenotes?.length) {
        errors.push(`Grace notes are not supported yet (${at}).`)
        continue
      }
      const pitchNumber = note.pitches[0].pitch
      if (note.pitches[0].endTie) {
        if (pitchNumber !== previousPitch) {
          errors.push(`A tie must join two notes of the same pitch; use ( ) for a slur (${at}).`)
          continue
        }
        const previous = targets[targets.length - 1]
        if (previous) previous.durationWhole += note.duration
        continue
      }
      previousPitch = pitchNumber
      const midi = note.midiPitches?.[0]?.pitch
      if (midi === undefined) {
        errors.push(`Could not determine the pitch of the note ${at}.`)
        continue
      }
      if (midi < FIRST_POSITION_LOWEST_MIDI) {
        errors.push(`${noteName(midi, preferFlats)} is below the violin's lowest note (G3) (${at}).`)
        continue
      }
      const fingers = (note.decoration ?? []).filter((d) => FINGER_DECORATIONS.has(d))
      if ((note.decoration ?? []).includes('5')) {
        errors.push(`Finger 5 does not exist on the violin (${at}).`)
        continue
      }
      let fingering = defaultFingering(midi)
      if (fingers.length > 0) {
        const finger = Number(fingers[0]) as Finger
        fingering = fingeringWithFinger(midi, finger)
        if (fingering === null) {
          errors.push(
            `${noteName(midi, preferFlats)} cannot be played with finger ${finger} in first position (${at}).`,
          )
          continue
        }
      } else if (fingering === null) {
        warnings.push(
          `${noteName(midi, preferFlats)} is outside first position; no hint is shown for it (${at}).`,
        )
      }
      targets.push({
        index: targets.length,
        midi,
        durationWhole: note.duration,
        fingering,
        sourceStart: note.startChar,
      })
    }
  }

  if (errors.length === 0 && targets.length === 0) errors.push('The exercise has no notes.')
  if (errors.length > 0) return { ok: false, errors }

  const exercise: Exercise = {
    title: tune.metaText.title ?? 'Untitled',
    abc,
    targets,
    preferFlats,
  }
  return { ok: true, exercise, warnings }
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}
