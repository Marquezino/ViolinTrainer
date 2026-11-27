import { expect, test } from 'vitest'
import { nearestOpenString, OPEN_STRING_MIDI, TUNING_GREEN_CENTS } from './tuning'

test('the open strings and the green zone', () => {
  expect(OPEN_STRING_MIDI).toEqual([55, 62, 69, 76])
  expect(TUNING_GREEN_CENTS).toBe(5)
})

test('440 Hz is the A string, in tune', () => {
  const r = nearestOpenString(440, 440)
  expect(r.midi).toBe(69)
  expect(r.cents).toBeCloseTo(0, 6)
})

test('a G 10 cents sharp', () => {
  const r = nearestOpenString(196 * 2 ** (10 / 1200), 440)
  expect(r.midi).toBe(55)
  // 196 Hz is itself 0.03 cents above equal-tempered G3.
  expect(r.cents).toBeCloseTo(10, 1)
})

test('300 Hz is nearest to the D string', () => {
  const r = nearestOpenString(300, 440)
  expect(r.midi).toBe(62)
  expect(r.cents).toBeCloseTo(1200 * Math.log2(300 / (440 * 2 ** (-7 / 12))), 6)
})

test('follows the A4 setting', () => {
  const r = nearestOpenString(442, 442)
  expect(r.midi).toBe(69)
  expect(r.cents).toBeCloseTo(0, 6)
})

test('far outside the strings it still picks the nearest one', () => {
  expect(nearestOpenString(100, 440).midi).toBe(55)
  expect(nearestOpenString(1500, 440).midi).toBe(76)
  // A4 to E5 is 700 cents, so the boundary is 350 cents above A4.
  expect(nearestOpenString(440 * 2 ** (340 / 1200), 440).midi).toBe(69)
  expect(nearestOpenString(440 * 2 ** (360 / 1200), 440).midi).toBe(76)
})
