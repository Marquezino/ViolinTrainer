import { describe, expect, test } from 'vitest'
import { DEFAULT_TRACKER_CONFIG, median, type TrackerConfig } from './note-tracker'
import { analyzeSignal, trackNotes } from './offline'
import { centsBetween, midiToHz } from '../music/pitch'
import { SAMPLE_RATE, VIOLIN_HARMONICS, concat, noise, silence, tone } from '../test-support/synth'

const QUIET_ROOM: TrackerConfig = { ...DEFAULT_TRACKER_CONFIG, noiseFloorDb: -70 }
const A4 = midiToHz(69)
const B4 = midiToHz(71)

function play(signal: Float32Array, config = QUIET_ROOM) {
  return trackNotes(analyzeSignal(signal, SAMPLE_RATE), config)
}

function violin(hz: number, ms: number, extra: Partial<Parameters<typeof tone>[0]> = {}) {
  return tone({ hz, ms, harmonics: VIOLIN_HARMONICS, ...extra })
}

describe('median', () => {
  test('odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
})

describe('NoteTracker', () => {
  test('one steady note gives exactly one event, after the stability window', () => {
    const events = play(concat(silence(100), violin(A4, 500), silence(100)))
    expect(events).toHaveLength(1)
    expect(Math.abs(centsBetween(events[0].hz, A4))).toBeLessThan(1)
    const confirmDelay = events[0].timeMs - events[0].startMs
    expect(confirmDelay).toBeGreaterThanOrEqual(120)
    expect(confirmDelay).toBeLessThan(135)
  })

  test('two different notes played legato give two events', () => {
    const events = play(concat(violin(A4, 400, { releaseMs: 0 }), violin(B4, 400, { attackMs: 0 })))
    expect(events.map((e) => Math.round(centsBetween(e.hz, A4) / 100))).toEqual([0, 2])
  })

  test('the same note twice with a short silence gives two events', () => {
    const events = play(concat(violin(A4, 300), silence(50), violin(A4, 300)))
    expect(events).toHaveLength(2)
  })

  function withDip(ms: number, amplitude: number) {
    const dip = violin(A4, ms, { amplitude, attackMs: 0, releaseMs: 0 })
    return concat(violin(A4, 300, { releaseMs: 0 }), dip, violin(A4, 300, { attackMs: 0 }))
  }

  test('the same note twice with a level dip (bow change) gives two events', () => {
    expect(play(withDip(40, 0.1))).toHaveLength(2) // 10 dB dip
    expect(play(withDip(40, 0.01))).toHaveLength(2) // so deep that pitch is lost for a moment
  })

  test('a dip shorter than the re-attack time is not a new note', () => {
    expect(play(withDip(20, 0.03))).toHaveLength(1)
  })

  test('a held note without a dip stays one event', () => {
    expect(play(violin(A4, 800))).toHaveLength(1)
  })

  test('a short blip is ignored', () => {
    expect(play(concat(silence(100), violin(A4, 60), silence(100)))).toHaveLength(0)
  })

  test('a slide between two notes gives only the two held notes', () => {
    const signal = concat(
      violin(A4, 300, { releaseMs: 0 }),
      violin(A4, 300, { endHz: B4, attackMs: 0, releaseMs: 0 }),
      violin(B4, 300, { attackMs: 0 }),
    )
    const events = play(signal)
    expect(events).toHaveLength(2)
    expect(Math.abs(centsBetween(events[0].hz, A4))).toBeLessThan(5)
    expect(Math.abs(centsBetween(events[1].hz, B4))).toBeLessThan(5)
  })

  test('a slight pitch wobble (±5 cents) stays one note, measured near its center', () => {
    const events = play(violin(A4, 600, { vibrato: { rateHz: 6, widthCents: 5 } }))
    expect(events).toHaveLength(1)
    expect(Math.abs(centsBetween(events[0].hz, A4))).toBeLessThan(5)
  })

  test('a ±12 cent vibrato gives at most one note, judged within its width', () => {
    const events = play(violin(A4, 800, { vibrato: { rateHz: 6, widthCents: 12 } }))
    expect(events.length).toBeLessThanOrEqual(1)
    for (const e of events) expect(Math.abs(centsBetween(e.hz, A4))).toBeLessThanOrEqual(12)
  })

  const atCents = (cents: number) => A4 * 2 ** (cents / 1200)

  test('PRECISION: a slow glide is not a note until the pitch settles; the settled pitch is judged', () => {
    for (const offsetMs of [0, 3, 6, 9]) {
      const signal = concat(
        silence(offsetMs),
        violin(atCents(-60), 800, { endHz: atCents(60), releaseMs: 0 }),
        violin(atCents(60), 400, { attackMs: 0 }),
      )
      const events = play(signal)
      expect(events).toHaveLength(1)
      expect(centsBetween(events[0].hz, A4)).toBeCloseTo(60, -1)
    }
  })

  test('after a note, moving the pitch slowly by more than 25 cents gives a new note (intonation correction)', () => {
    const signal = concat(
      violin(atCents(40), 400, { releaseMs: 0 }),
      violin(atCents(40), 500, { endHz: A4, attackMs: 0, releaseMs: 0 }),
      violin(A4, 600, { attackMs: 0 }),
    )
    const events = play(signal)
    expect(events).toHaveLength(2)
    expect(centsBetween(events[0].hz, A4)).toBeCloseTo(40, -1)
    // Judged once the slide (80 cents/s) has settled below the drift limit: already in the green zone.
    expect(Math.abs(centsBetween(events[1].hz, A4))).toBeLessThan(20)
  })

  test.each([48000, 44100])('a 40 ms bow-change dip separates repeated notes at %i Hz, at any alignment', (sr) => {
    for (const offsetMs of [0, 2, 4, 6, 8, 10]) {
      const n = (ms: number, extra: Partial<Parameters<typeof tone>[0]> = {}) =>
        tone({ hz: A4, ms, harmonics: VIOLIN_HARMONICS, ...extra }, sr)
      const signal = concat(
        silence(offsetMs, sr),
        n(300, { releaseMs: 0 }),
        n(40, { amplitude: 0.03, attackMs: 0, releaseMs: 0 }),
        n(300, { attackMs: 0 }),
      )
      expect(trackNotes(analyzeSignal(signal, sr), QUIET_ROOM)).toHaveLength(2)
    }
  })

  test('sound not clearly above the noise floor is ignored', () => {
    const noisyRoom: TrackerConfig = { ...DEFAULT_TRACKER_CONFIG, noiseFloorDb: -40 }
    expect(play(violin(A4, 500, { amplitude: 0.01 }), noisyRoom)).toHaveLength(0) // about -45 dBFS
  })

  test('noise alone produces no notes', () => {
    expect(play(noise(1000, 0.1))).toHaveLength(0)
  })
})
