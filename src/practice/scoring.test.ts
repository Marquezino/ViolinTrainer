import { expect, test } from 'vitest'
import { scoreRun, targetPoints } from './scoring'
import type { TargetState } from './wait-session'

function t(color: TargetState['color'], redAttempts = 0): TargetState {
  return { color, redAttempts, centsAtAcceptance: color ? 0 : null, hintVisible: false }
}

test('points per target', () => {
  expect(targetPoints(t('green'))).toBe(2)
  expect(targetPoints(t('yellow'))).toBe(1)
  expect(targetPoints(t('green', 1))).toBe(1) // accepted after a red attempt
  expect(targetPoints(t('yellow', 3))).toBe(1)
  expect(targetPoints(t(null))).toBe(0)
})

test('3 stars at exactly 90%', () => {
  const targets = [...Array(9).fill(t('green')), t('yellow'), ...Array(5).fill(t('green'))] // 29/30
  expect(scoreRun(targets, true).stars).toBe(3)
  const exactly90 = [...Array(8).fill(t('green')), t('yellow'), t('yellow')] // 18/20
  expect(scoreRun(exactly90, true)).toEqual({ points: 18, maxPoints: 20, stars: 3 })
})

test('2 stars at exactly 70%, 1 star below', () => {
  const exactly70 = [...Array(4).fill(t('green')), ...Array(6).fill(t('yellow'))] // 14/20
  expect(scoreRun(exactly70, true).stars).toBe(2)
  const below = [...Array(3).fill(t('green')), ...Array(7).fill(t('yellow'))] // 13/20
  expect(scoreRun(below, true).stars).toBe(1)
})

test('an unfinished run earns no stars', () => {
  expect(scoreRun([t('green'), t(null)], false).stars).toBe(0)
})
