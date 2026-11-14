import type { Finger, Fingering } from '../music/fingering'

export interface Target {
  index: number
  midi: number
  /** Written duration as a fraction of a whole note (ties merged). */
  durationWhole: number
  /** Null when the note is outside first position: no hint is shown. */
  fingering: Fingering | null
  /**
   * Character offsets in the ABC source of the note and of each note tied to it; they link the
   * target to its rendered elements.
   */
  sourceStarts: number[]
}

export interface Exercise {
  /** Null when the ABC has no T: line. */
  title: string | null
  abc: string
  targets: Target[]
  /** Spell played notes with flats (for keys with flats in the signature). */
  preferFlats: boolean
}

/** Something the checker found in the ABC; the UI turns it into a message. `at` is a character offset. */
export type AbcProblem =
  | { code: 'noTune' }
  | { code: 'multipleTunes' }
  | { code: 'abcSyntax'; detail: string; line: number | null; column: number | null }
  | { code: 'multipleVoices' }
  | { code: 'repeats'; at: number }
  | { code: 'chord'; at: number }
  | { code: 'graceNotes'; at: number }
  | { code: 'tieDifferentPitch'; at: number }
  | { code: 'unknownPitch'; at: number }
  | { code: 'belowViolin'; midi: number; lowestMidi: number; at: number }
  | { code: 'tooHigh'; midi: number; highestMidi: number; at: number }
  | { code: 'fingerFive'; at: number }
  | { code: 'fingerImpossible'; midi: number; finger: Finger; at: number }
  | { code: 'outsideFirstPosition'; midi: number; at: number }
  | { code: 'noNotes' }
export type AbcProblemCode = AbcProblem['code']

export type ParseResult =
  | { ok: true; exercise: Exercise; warnings: AbcProblem[] }
  | { ok: false; errors: AbcProblem[]; preferFlats: boolean }
