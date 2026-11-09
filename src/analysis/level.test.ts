import { expect, test } from 'vitest'
import { MAX_NOISE_FLOOR_DB, isTooNoisy, noiseFloorDb } from './level'

test('noise floor is the 90th percentile, so a single click does not count', () => {
  const levels = [-80, -79, -81, -80, -78, -80, -79, -80, -81, -20]
  expect(noiseFloorDb(levels)).toBe(-78)
})

test('an empty list is a programming error', () => {
  expect(() => noiseFloorDb([])).toThrow()
})

test('too noisy above the limit', () => {
  expect(isTooNoisy(MAX_NOISE_FLOOR_DB + 1)).toBe(true)
  expect(isTooNoisy(MAX_NOISE_FLOOR_DB)).toBe(false)
  expect(isTooNoisy(-70)).toBe(false)
  expect(isTooNoisy(-45)).toBe(false) // a quiet room with a computer fan
})
