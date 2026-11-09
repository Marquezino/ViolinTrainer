import { describe, expect, test } from 'vitest'
import {
  FIRST_POSITION_HIGHEST_MIDI,
  FIRST_POSITION_LOWEST_MIDI,
  defaultFingering,
  fingeringLabel,
  fingeringWithFinger,
  noteKey,
} from './fingering'

describe('defaultFingering', () => {
  test('open strings', () => {
    expect(defaultFingering(55)).toEqual({ string: 'G', finger: 0, mark: null })
    expect(defaultFingering(62)).toEqual({ string: 'D', finger: 0, mark: null })
    expect(defaultFingering(69)).toEqual({ string: 'A', finger: 0, mark: null })
    expect(defaultFingering(76)).toEqual({ string: 'E', finger: 0, mark: null })
  })

  test('fingers on the A string', () => {
    expect(defaultFingering(70)).toEqual({ string: 'A', finger: 1, mark: 'low' }) // B♭4
    expect(defaultFingering(71)).toEqual({ string: 'A', finger: 1, mark: null }) // B4
    expect(defaultFingering(72)).toEqual({ string: 'A', finger: 2, mark: 'low' }) // C5
    expect(defaultFingering(73)).toEqual({ string: 'A', finger: 2, mark: 'high' }) // C♯5
    expect(defaultFingering(74)).toEqual({ string: 'A', finger: 3, mark: null }) // D5
    expect(defaultFingering(75)).toEqual({ string: 'A', finger: 3, mark: 'high' }) // D♯5
  })

  test('highest first-position note is 4th finger on E', () => {
    expect(defaultFingering(83)).toEqual({ string: 'E', finger: 4, mark: null })
  })

  test('outside first position there is no fingering', () => {
    expect(defaultFingering(FIRST_POSITION_LOWEST_MIDI - 1)).toBeNull()
    expect(defaultFingering(FIRST_POSITION_HIGHEST_MIDI + 1)).toBeNull()
  })

  test('every note in range has a fingering', () => {
    for (let m = FIRST_POSITION_LOWEST_MIDI; m <= FIRST_POSITION_HIGHEST_MIDI; m++) {
      expect(defaultFingering(m)).not.toBeNull()
    }
  })
})

describe('fingeringWithFinger', () => {
  test('4th finger instead of the open string', () => {
    expect(fingeringWithFinger(69, 4)).toEqual({ string: 'D', finger: 4, mark: null })
    expect(fingeringWithFinger(62, 4)).toEqual({ string: 'G', finger: 4, mark: null })
    expect(fingeringWithFinger(76, 4)).toEqual({ string: 'A', finger: 4, mark: null })
  })

  test('explicit open string', () => {
    expect(fingeringWithFinger(69, 0)).toEqual({ string: 'A', finger: 0, mark: null })
  })

  test('impossible combinations return null', () => {
    expect(fingeringWithFinger(71, 3)).toBeNull() // B4 is never 3rd finger in first position
    expect(fingeringWithFinger(55, 4)).toBeNull()
  })
})

describe('labels and keys', () => {
  test('label shows string, finger and mark', () => {
    expect(fingeringLabel({ string: 'A', finger: 2, mark: 'high' })).toBe('A 2↑')
    expect(fingeringLabel({ string: 'D', finger: 1, mark: 'low' })).toBe('D 1↓')
    expect(fingeringLabel({ string: 'E', finger: 0, mark: null })).toBe('E 0')
  })

  test('note key distinguishes the same pitch on different strings', () => {
    expect(noteKey(69, { string: 'A', finger: 0, mark: null })).toBe('69:A0')
    expect(noteKey(69, { string: 'D', finger: 4, mark: null })).toBe('69:D4')
  })
})
