import { describe, expect, test } from 'vitest'
import fc from 'fast-check'
import { createFrameAnalyzer, rmsDb } from './frame-analyzer'
import { analyzeSignal } from './offline'
import { centsBetween, midiToHz } from '../music/pitch'
import {
  SAMPLE_RATE,
  VIOLIN_HARMONICS,
  WEAK_FUNDAMENTAL_HARMONICS,
  mix,
  noise,
  rumble,
  silence,
  tone,
} from '../test-support/synth'

/** Frames from the steady middle of a 500 ms tone (skips attack and release). */
function steadyFrames(signal: Float32Array) {
  return analyzeSignal(signal, SAMPLE_RATE).slice(5, -5)
}

describe('rmsDb', () => {
  test('full-scale sine is about -3 dBFS; silence is the floor', () => {
    expect(rmsDb(tone({ hz: 440, ms: 100, amplitude: 1, attackMs: 0, releaseMs: 0 }))).toBeCloseTo(-3.01, 1)
    expect(rmsDb(new Float32Array(2048))).toBe(-120)
  })
})

describe('frame analyzer', () => {
  test('violin-like tones across first position are within 1 cent', () => {
    for (let midi = 55; midi <= 83; midi++) {
      const hz = midiToHz(midi)
      for (const f of steadyFrames(tone({ hz, ms: 500, harmonics: VIOLIN_HARMONICS }))) {
        expect(f.hz).not.toBeNull()
        expect(Math.abs(centsBetween(f.hz!, hz))).toBeLessThan(1)
        expect(f.clarity).toBeGreaterThan(0.95)
      }
    }
  })

  test('no octave error on G-string notes with a weak fundamental', () => {
    for (const midi of [55, 56, 57, 58, 59, 60, 61, 62]) {
      const hz = midiToHz(midi)
      for (const f of steadyFrames(tone({ hz, ms: 500, harmonics: WEAK_FUNDAMENTAL_HARMONICS }))) {
        expect(Math.abs(centsBetween(f.hz!, hz))).toBeLessThan(1)
      }
    }
  })

  test.each([
    [[0, 1, 0.2, 0.4, 0.1]],
    [[0.1, 1, 0.1, 0.5]],
    [[0, 1, 0.1, 0.1]],
  ])('no octave-up error when the fundamental is missing (spectrum %j)', (harmonics) => {
    for (let midi = 55; midi <= 64; midi++) {
      const hz = midiToHz(midi)
      for (const f of steadyFrames(tone({ hz, ms: 500, harmonics }))) {
        expect(Math.abs(centsBetween(f.hz!, hz))).toBeLessThan(1)
      }
    }
  })

  test('PROPERTY: a tone whose fundamental is present is never moved an octave down', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 55, max: 83 }),
        fc.integer({ min: -45, max: 45 }),
        fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: 0, maxLength: 7 }),
        fc.constantFrom(44100, 48000),
        (midi, cents, upper, sr) => {
          const hz = midiToHz(midi) * 2 ** (cents / 1200)
          const frames = analyzeSignal(tone({ hz, ms: 200, harmonics: [1, ...upper] }, sr), sr).slice(3, -3)
          for (const f of frames) expect(Math.abs(centsBetween(f.hz!, hz))).toBeLessThan(5)
        },
      ),
      { numRuns: 60 },
    )
  })

  test('a detuned tone is measured as detuned', () => {
    const hz = midiToHz(69) * 2 ** (30 / 1200)
    for (const f of steadyFrames(tone({ hz, ms: 500, harmonics: VIOLIN_HARMONICS }))) {
      expect(centsBetween(f.hz!, midiToHz(69))).toBeCloseTo(30, 0)
    }
  })

  test('silence, white noise and rumble alone give no pitch', () => {
    for (const signal of [silence(500), noise(500, 0.05), rumble(500, 0.3)]) {
      for (const f of analyzeSignal(signal, SAMPLE_RATE)) expect(f.hz).toBeNull()
    }
  })

  test('rumble at half the violin level does not disturb the pitch', () => {
    for (const [hz, harmonics] of [
      [440, VIOLIN_HARMONICS],
      [196, WEAK_FUNDAMENTAL_HARMONICS],
    ] as const) {
      const signal = mix(tone({ hz, ms: 500, harmonics: [...harmonics], amplitude: 0.1 }), rumble(500, 0.05))
      for (const f of steadyFrames(signal)) {
        expect(Math.abs(centsBetween(f.hz!, hz))).toBeLessThan(5)
        expect(f.clarity).toBeGreaterThan(0.9)
      }
    }
  })

  test('PRECISION: rumble louder than the violin never produces a wrong pitch', () => {
    const signal = mix(tone({ hz: 440, ms: 500, harmonics: VIOLIN_HARMONICS, amplitude: 0.1 }), rumble(500, 0.2))
    for (const f of steadyFrames(signal)) {
      if (f.hz !== null) expect(Math.abs(centsBetween(f.hz, 440))).toBeLessThan(5)
    }
  })

  test('a clipped (too loud) tone is still measured at the right pitch', () => {
    const loud = tone({ hz: 440, ms: 500, harmonics: VIOLIN_HARMONICS, amplitude: 3 }).map((x) => Math.max(-1, Math.min(1, x)))
    for (const f of steadyFrames(loud)) expect(Math.abs(centsBetween(f.hz!, 440))).toBeLessThan(1)
  })

  test('pitches outside the violin range are reported as null', () => {
    const analyze = createFrameAnalyzer(2048, 512)
    const low = tone({ hz: 120, ms: 100, attackMs: 0, releaseMs: 0 }).subarray(0, 2048)
    expect(analyze(low, SAMPLE_RATE).hz).toBeNull()
  })

  test('works at 44.1 kHz as well as 48 kHz', () => {
    const sr = 44100
    const frames = analyzeSignal(tone({ hz: 440, ms: 500, harmonics: VIOLIN_HARMONICS }, sr), sr).slice(5, -5)
    for (const f of frames) expect(Math.abs(centsBetween(f.hz!, 440))).toBeLessThan(1)
    expect(frames[1].timeMs - frames[0].timeMs).toBeCloseTo((512 / sr) * 1000, 6)
  })
})
