import { expect, test } from 'vitest'
import type { Attempt } from '../store/records'
import type { Stars } from '../practice/scoring'
import type { Day } from './days'
import { weeklyLeaderboard } from './leaderboard'
import type { ProfileHistory } from './history'

// Tests run in America/New_York (vite.config.ts). 2026-11-25 is a Wednesday.
const TODAY: Day = '2026-11-25'

function at(day: Day, hour = 10): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, hour).getTime()
}

function run(day: Day, minutes: number, stars: Stars = 1, completed = true): Attempt {
  return {
    id: `a-${day}-${Math.random()}`,
    profileId: 'p',
    exerciseId: 'x',
    startedAt: at(day),
    finishedAt: null,
    completed,
    points: 0,
    maxPoints: 0,
    stars,
    activeMs: minutes * 60_000,
    results: [],
  }
}

function hist(attempts: Attempt[]): ProfileHistory {
  return { attempts, goals: [], repairs: [] }
}

test('ranks by goal days, then completed runs, with shared places', () => {
  const rows = weeklyLeaderboard(
    [
      { profileId: 'c', history: hist([run('2026-11-23', 10)]) },
      { profileId: 'a', history: hist([run('2026-11-23', 10), run('2026-11-24', 10)]) },
      { profileId: 'b', history: hist([run('2026-11-23', 10), run('2026-11-24', 10)]) },
      { profileId: 'd', history: hist([run('2026-11-23', 10), run('2026-11-23', 1)]) },
    ],
    TODAY,
  )
  expect(rows.map((r) => [r.profileId, r.place])).toEqual([
    ['a', 1],
    ['b', 1],
    ['d', 3],
    ['c', 4],
  ])
  expect(rows[0].week).toEqual([true, true, false, false, false, false, false])
  expect(rows[2].goalDays).toBe(1)
  expect(rows[2].completedRuns).toBe(2)
})

test('stars do not affect the ranking', () => {
  const rows = weeklyLeaderboard(
    [
      { profileId: 'a', history: hist([run('2026-11-23', 10, 3)]) },
      { profileId: 'b', history: hist([run('2026-11-23', 10, 0)]) },
    ],
    TODAY,
  )
  expect(rows.map((r) => r.place)).toEqual([1, 1])
})

test('only this Monday..Sunday counts', () => {
  const rows = weeklyLeaderboard(
    [{ profileId: 'a', history: hist([run('2026-11-22', 10), run('2026-11-30', 10)]) }],
    TODAY,
  )
  expect(rows[0].goalDays).toBe(0)
  expect(rows[0].completedRuns).toBe(0)
  expect(rows[0].week).toEqual(Array(7).fill(false))
})

test('a single profile is place 1', () => {
  const rows = weeklyLeaderboard([{ profileId: 'a', history: hist([]) }], TODAY)
  expect(rows).toEqual([
    { profileId: 'a', place: 1, goalDays: 0, completedRuns: 0, week: Array(7).fill(false) },
  ])
})
