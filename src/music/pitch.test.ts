import { describe, expect, test } from 'vitest'
import fc from 'fast-check'
import {
  DEFAULT_TOLERANCES,
  centsBetween,
  hzToMidiFloat,
  judge,
  midiToHz,
  noteName,
  validateTolerances,
} from './pitch'

describe('conversions', () => {
  test('A4 is 440 Hz by default and follows the reference', () => {
    expect(midiToHz(69)).toBe(440)
    expect(midiToHz(69, 442)).toBe(442)
    expect(midiToHz(55)).toBeCloseTo(196.0, 1) // open G
    expect(midiToHz(81)).toBeCloseTo(880, 6)
  })

  test('hzToMidiFloat inverts midiToHz', () => {
    expect(hzToMidiFloat(440)).toBe(69)
    expect(hzToMidiFloat(midiToHz(62))).toBeCloseTo(62, 9)
  })

  test('cents', () => {
    expect(centsBetween(880, 440)).toBeCloseTo(1200, 9)
    expect(centsBetween(445, 440)).toBeCloseTo(19.56, 2)
    expect(centsBetween(450, 440)).toBeCloseTo(38.9, 1)
  })
})

describe('judge', () => {
  const tol = DEFAULT_TOLERANCES // green 20, yellow 35

  test('classifies by deviation from the target', () => {
    expect(judge(440, 69, tol).kind).toBe('green')
    expect(judge(445, 69, tol).kind).toBe('green') // +19.6 cents
    expect(judge(447, 69, tol).kind).toBe('yellow') // +27.3 cents
    expect(judge(450, 69, tol).kind).toBe('outOfTune') // +38.9 cents
    expect(judge(466.16, 69, tol)).toMatchObject({ kind: 'wrongNote', playedMidi: 70 })
  })

  test('uses the configured A4', () => {
    expect(judge(442, 69, tol, 442).kind).toBe('green')
    expect(judge(442, 69, tol, 440).kind).toBe('green') // +7.9 cents
  })

  test('PROPERTY: a deviation beyond the yellow tolerance is never accepted', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 55, max: 83 }),
        fc.double({ min: -600, max: 600, noNaN: true }),
        (target, cents) => {
          fc.pre(Math.abs(Math.abs(cents) - tol.yellowCents) > 1e-6)
          const hz = midiToHz(target) * 2 ** (cents / 1200)
          const kind = judge(hz, target, tol).kind
          const accepted = kind === 'green' || kind === 'yellow'
          if (Math.abs(cents) > tol.yellowCents) expect(accepted).toBe(false)
        },
      ),
    )
  })

  test('PROPERTY: a different semitone or octave is never accepted', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 55, max: 83 }),
        fc.integer({ min: -24, max: 24 }).filter((d) => d !== 0),
        fc.double({ min: -49, max: 49, noNaN: true }),
        (target, semitones, cents) => {
          const hz = midiToHz(target + semitones) * 2 ** (cents / 1200)
          expect(judge(hz, target, tol).kind).toBe('wrongNote')
        },
      ),
    )
  })
})

describe('validateTolerances', () => {
  test('accepts the defaults', () => {
    expect(validateTolerances(DEFAULT_TOLERANCES)).toBeNull()
  })
  test('rejects inconsistent values', () => {
    expect(validateTolerances({ greenCents: 0, yellowCents: 10 })).not.toBeNull()
    expect(validateTolerances({ greenCents: 30, yellowCents: 20 })).not.toBeNull()
    expect(validateTolerances({ greenCents: 20, yellowCents: 50 })).not.toBeNull()
  })
})

describe('noteName', () => {
  test('names notes with octave numbers', () => {
    expect(noteName(55, false)).toBe('G3')
    expect(noteName(60, false)).toBe('C4')
    expect(noteName(70, false)).toBe('A♯4')
    expect(noteName(70, true)).toBe('B♭4')
  })
})
