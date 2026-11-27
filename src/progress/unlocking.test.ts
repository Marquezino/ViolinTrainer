import { expect, test } from 'vitest'
import type { Attempt } from '../store/records'
import type { Stars } from '../practice/scoring'
import { bestStars, bestStarsSum, nextToPlay, unlockedExercises } from './unlocking'

function attempt(exerciseId: string, stars: Stars, completed = true): Attempt {
  return {
    id: `a-${exerciseId}-${stars}-${Math.random()}`,
    profileId: 'p',
    exerciseId,
    startedAt: 0,
    finishedAt: completed ? 1 : null,
    completed,
    points: 0,
    maxPoints: 0,
    stars,
    activeMs: 0,
    results: [],
  }
}

test('first exercise is always unlocked; the next one unlocks at 2 stars', () => {
  const path = ['a', 'b', 'c']
  expect([...unlockedExercises(path, [], [])]).toEqual(['a'])
  expect([...unlockedExercises(path, [attempt('a', 1)], [])].sort()).toEqual(['a'])
  const two = [attempt('a', 1), attempt('a', 2)]
  expect([...unlockedExercises(path, two, [])].sort()).toEqual(['a', 'b'])
  const best = bestStars(two)
  expect(best.get('a')).toBe(2)
  expect(bestStarsSum(best)).toBe(2)
  expect(nextToPlay(path, unlockedExercises(path, two, []), best)).toBe('b')
})

test('unlocking runs across units', () => {
  const path = ['u1-a', 'u1-b', 'u2-a']
  const attempts = [attempt('u1-a', 3), attempt('u1-b', 2)]
  const unlocked = unlockedExercises(path, attempts, [])
  expect([...unlocked]).toEqual(path)
  expect(nextToPlay(path, unlocked, bestStars(attempts))).toBe('u2-a')
})

test('an exercise with any attempt stays unlocked after it moves later in the path', () => {
  const attempts = [attempt('x', 0, false)]
  const unlocked = unlockedExercises(['a', 'b', 'x'], attempts, [])
  expect(unlocked.has('x')).toBe(true)
  expect(unlocked.has('b')).toBe(false)
  expect(unlockedExercises(['a', 'b'], [], ['b']).has('b')).toBe(true)
})

test('empty path unlocks nothing and nextToPlay is null', () => {
  const unlocked = unlockedExercises([], [attempt('a', 3)], ['a'])
  expect(unlocked.size).toBe(0)
  expect(nextToPlay([], unlocked, new Map())).toBeNull()
})

test('deleted exercises are not in the result even if played', () => {
  const unlocked = unlockedExercises(['a', 'b'], [attempt('gone', 3)], ['gone2'])
  expect([...unlocked]).toEqual(['a'])
})

test('an unfinished run never earns stars or unlocks the next exercise', () => {
  const attempts = [attempt('a', 3, false)]
  expect(bestStars(attempts).size).toBe(0)
  const unlocked = unlockedExercises(['a', 'b'], attempts, [])
  expect(unlocked.has('b')).toBe(false)
})

test('nextToPlay falls back to the last unlocked exercise when all have 2+ stars', () => {
  const path = ['a', 'b', 'c']
  const attempts = [attempt('a', 2), attempt('b', 3)]
  const unlocked = unlockedExercises(path, attempts, [])
  expect(unlocked.has('c')).toBe(true)
  const best = new Map<string, Stars>([['a', 2], ['b', 3], ['c', 2]])
  expect(nextToPlay(path, unlocked, best)).toBe('c')
  expect(nextToPlay(['a', 'b'], new Set(['a']), new Map<string, Stars>([['a', 3]]))).toBe('a')
})
