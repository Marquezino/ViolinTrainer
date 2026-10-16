import { describe, expect, test } from 'vitest'
import { analyzeSignal } from '../analysis/offline'
import { DEFAULT_TOLERANCES, midiToHz } from '../music/pitch'
import { parseExercise } from '../score/abc'
import type { Exercise } from '../score/exercise'
import {
  SAMPLE_RATE,
  VIOLIN_HARMONICS,
  WEAK_FUNDAMENTAL_HARMONICS,
  concat,
  mix,
  noise,
  rumble,
  silence,
  tone,
} from '../test-support/synth'
import { PracticeEngine } from './engine'
import { DEFAULT_HINT_DELAY_MS, startSession, type SessionConfig } from './wait-session'

const config: SessionConfig = {
  tolerances: DEFAULT_TOLERANCES,
  a4Hz: 440,
  hintDelayMs: DEFAULT_HINT_DELAY_MS,
  initialHint: () => true,
}

function exercise(body: string): Exercise {
  const r = parseExercise(`X:1\nT:t\nM:4/4\nL:1/4\nK:D\n${body}`)
  if (!r.ok) throw new Error(r.errors.join('; '))
  return r.exercise
}

/** A quiet room for the microphone check (2.1 s), then the performance. */
function run(ex: Exercise, performance: Float32Array, room = silence(2100)) {
  const engine = new PracticeEngine(startSession(ex, config, 0))
  for (const f of analyzeSignal(concat(room, performance), SAMPLE_RATE)) engine.handleFrame(f)
  return engine.snapshot()
}

function note(midi: number, ms = 400, cents = 0, harmonics = VIOLIN_HARMONICS) {
  return concat(tone({ hz: midiToHz(midi) * 2 ** (cents / 1200), ms, harmonics }), silence(60))
}

describe('PracticeEngine with synthetic performances', () => {
  test('open strings played in tune: all green, 3 stars', () => {
    const ex = exercise('G, D A e |]')
    const s = run(ex, concat(note(55, 400, 0, WEAK_FUNDAMENTAL_HARMONICS), note(62), note(69), note(76)))
    expect(s.phase).toBe('finished')
    expect(s.session.targets.map((t) => t.color)).toEqual(['green', 'green', 'green', 'green'])
    expect(s.result).toEqual({ points: 8, maxPoints: 8, stars: 3 })
  })

  test('a wrong note is rejected, then the right note is accepted with a red marker', () => {
    const ex = exercise('A B |]')
    const s = run(ex, concat(note(69), note(72), note(71)))
    expect(s.phase).toBe('finished')
    expect(s.session.targets[1]).toMatchObject({ color: 'green', redAttempts: 1 })
    expect(s.result?.points).toBe(3)
  })

  test('PRECISION: a wrong note never advances the cursor', () => {
    const ex = exercise('A B |]')
    const s = run(ex, concat(note(69), note(72), note(70), note(73)))
    expect(s.phase).toBe('practicing')
    expect(s.session.cursor).toBe(1)
    expect(s.session.targets[1]).toMatchObject({ color: null, redAttempts: 3 })
    expect(s.lastRejection).toMatchObject({ index: 1, kind: 'wrongNote', playedName: 'C♯5' })
  })

  test('PRECISION: 40 cents sharp is out of tune and does not advance', () => {
    const s = run(exercise('A |]'), note(69, 400, 40))
    expect(s.session.cursor).toBe(0)
    expect(s.lastRejection).toMatchObject({ kind: 'outOfTune' })
  })

  test('28 cents flat is yellow', () => {
    const s = run(exercise('A |]'), note(69, 400, -28))
    expect(s.session.targets[0].color).toBe('yellow')
  })

  test('repeated notes need a re-attack: separated notes complete the exercise', () => {
    const s = run(exercise('A A A |]'), concat(note(69), note(69), note(69)))
    expect(s.phase).toBe('finished')
  })

  test('repeated notes held as one long sound only count once', () => {
    const s = run(exercise('A A |]'), tone({ hz: 440, ms: 1200, harmonics: VIOLIN_HARMONICS }))
    expect(s.session.cursor).toBe(1)
  })

  test('playing works with moderate traffic rumble and room noise', () => {
    const ex = exercise('D A |]')
    const performance = concat(note(62), note(69))
    const noisy = mix(performance, rumble(performance.length / 48, 0.02), noise(performance.length / 48, 0.001))
    const room = mix(rumble(2100, 0.0005), noise(2100, 0.0005))
    expect(run(ex, noisy, room).phase).toBe('finished')
  })

  test('a noisy room blocks practice', () => {
    const s = run(exercise('A |]'), note(69), noise(2100, 0.05))
    expect(s.phase).toBe('tooNoisy')
    expect(s.session.cursor).toBe(0)
  })

  test('playing during the room check blocks practice instead of measuring a wrong floor', () => {
    const s = run(exercise('A |]'), note(69), tone({ hz: 440, ms: 2100, harmonics: VIOLIN_HARMONICS }))
    expect(s.phase).toBe('tooNoisy')
  })

  test('works with a 44.1 kHz microphone', () => {
    const sr = 44100
    const engine = new PracticeEngine(startSession(exercise('D A |]'), config, 0))
    const performance = concat(
      silence(2100, sr),
      tone({ hz: midiToHz(62), ms: 400, harmonics: VIOLIN_HARMONICS }, sr),
      silence(60, sr),
      tone({ hz: midiToHz(69), ms: 400, harmonics: VIOLIN_HARMONICS }, sr),
      silence(60, sr),
    )
    for (const f of analyzeSignal(performance, sr)) engine.handleFrame(f)
    expect(engine.snapshot().phase).toBe('finished')
    expect(engine.snapshot().result?.stars).toBe(3)
  })

  test('the needle shows cents while a note sounds, and the played note name when far off', () => {
    const ex = exercise('A |]')
    const engine = new PracticeEngine(startSession(ex, config, 0))
    const frames = analyzeSignal(concat(silence(2100), tone({ hz: midiToHz(71), ms: 300 })), SAMPLE_RATE)
    let sawFarOff = false
    for (const f of frames) {
      engine.handleFrame(f)
      const needle = engine.snapshot().needle
      if (needle && needle.playedName === 'B4') sawFarOff = true
    }
    expect(sawFarOff).toBe(true)
  })
})
