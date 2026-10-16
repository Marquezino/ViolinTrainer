import { describe, expect, test } from 'vitest'
import fc from 'fast-check'
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

  test('PRECISION: a glide that ends on a wrong or out-of-tune pitch is never accepted', () => {
    const at = (cents: number) => midiToHz(69) * 2 ** (cents / 1200)
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: 40, max: 150 }),
        fc.boolean(),
        fc.integer({ min: 75, max: 600 }),
        fc.integer({ min: 0, max: 10 }),
        (startCents, endAbs, endSharp, centsPerSecond, offsetMs) => {
          const endCents = endSharp ? endAbs : -endAbs
          const glideMs = Math.max(50, (Math.abs(endCents - startCents) / centsPerSecond) * 1000)
          // One continuous tone, as a finger slides. Two joined tones would put a jump in the
          // waveform at the join that a real slide does not have.
          const performance = concat(
            silence(offsetMs),
            tone({ hz: at(startCents), endHz: at(endCents), slideMs: glideMs, ms: glideMs + 500, harmonics: VIOLIN_HARMONICS }),
          )
          expect(run(exercise('A |]'), performance).session.cursor).toBe(0)
        },
      ),
      // The examples were counterexamples found while tuning the tracker.
      {
        numRuns: 30,
        examples: [[0, 40, false, 150, 0], [22, 40, false, 150, 0], [0, 40, false, 76, 0], [51, 40, false, 72, 5]],
      },
    )
  })

  test('correcting a sharp note slowly is accepted once it settles in tune', () => {
    const at = (cents: number) => midiToHz(69) * 2 ** (cents / 1200)
    const performance = concat(
      tone({ hz: at(40), ms: 400, harmonics: VIOLIN_HARMONICS, releaseMs: 0 }),
      tone({ hz: at(40), endHz: at(0), ms: 600, harmonics: VIOLIN_HARMONICS, attackMs: 0, releaseMs: 0 }),
      tone({ hz: at(0), ms: 800, harmonics: VIOLIN_HARMONICS, attackMs: 0 }),
    )
    const s = run(exercise('A |]'), performance)
    expect(s.phase).toBe('finished')
    expect(s.session.targets[0]).toMatchObject({ color: 'green', redAttempts: 1 })
  })

  test('PRECISION: open G3 with a missing fundamental is not accepted as G4', () => {
    const g3 = tone({ hz: midiToHz(55), ms: 500, harmonics: [0, 1, 0.2, 0.4, 0.1] })
    const s = run(exercise('G |]'), g3)
    expect(s.session.cursor).toBe(0)
    expect(s.lastRejection).toMatchObject({ kind: 'wrongNote', playedName: 'G3' })
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

  test('playing softly during the room check also blocks practice (the floor would hide soft notes)', () => {
    const soft = tone({ hz: 440, ms: 2100, harmonics: VIOLIN_HARMONICS, amplitude: 0.002 })
    const s = run(exercise('A |]'), note(69, 400, 0), soft)
    expect(s.phase).toBe('tooNoisy')
    expect(s.noiseProblem).toBe('playing')
  })

  test('a loud unpitched room reports loudness, not playing', () => {
    expect(run(exercise('A |]'), note(69), noise(2100, 0.05)).noiseProblem).toBe('loud')
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
