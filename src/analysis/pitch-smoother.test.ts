import { expect, test } from 'vitest'
import { PitchSmoother } from './pitch-smoother'

test('returns the median of the recent window', () => {
  const s = new PitchSmoother(100)
  expect(s.push(440, 0)).toBe(440)
  expect(s.push(450, 10)).toBe(445)
  expect(s.push(441, 20)).toBe(441)
})

test('forgets values older than the window', () => {
  const s = new PitchSmoother(100)
  s.push(400, 0)
  s.push(400, 10)
  expect(s.push(440, 105)).toBe(420) // 400 at t=10 and 440 at t=105
  expect(s.push(440, 115)).toBe(440)
})

test('an unvoiced frame clears the needle', () => {
  const s = new PitchSmoother(100)
  s.push(440, 0)
  expect(s.push(null, 10)).toBeNull()
  expect(s.push(330, 20)).toBe(330)
})
