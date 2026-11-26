import 'fake-indexeddb/auto'
import { beforeEach, expect, test } from 'vitest'
import type { Day } from '../progress/days'
import { notesBalance } from '../progress/notes'
import { bestStars, bestStarsSum } from '../progress/unlocking'
import { openDatabase, type VtDatabase } from './db'
import { loadHistory } from './history'
import type { Attempt } from './records'
import { repairStreak } from './repairs'

let db: VtDatabase
beforeEach(() => {
  db = openDatabase(`test-${crypto.randomUUID()}`)
})

const MIN = 60_000
const NOW = new Date(2026, 10, 27, 9).getTime()

function at(day: Day, hour: number): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, hour).getTime()
}

function run(id: string, day: Day, minutes: number, stars: Attempt['stars']): Attempt {
  const startedAt = at(day, 10)
  return {
    id,
    profileId: 'p',
    exerciseId: `builtin:${id}`,
    startedAt,
    finishedAt: startedAt + minutes * MIN,
    completed: true,
    points: 0,
    maxPoints: 0,
    stars,
    activeMs: minutes * MIN,
    results: [],
  }
}

// Goal days 20 and 23 (10 ♪), then 24, 25 and 26 missed: both streaks broke
// yesterday. Four 3-star exercises add 12 ♪: 22 in all, enough for the easy
// repair (20) but not the practice one (40).
async function seed() {
  await db.attempts.bulkAdd([
    run('a', '2026-11-20', 10, 3),
    run('b', '2026-11-23', 10, 3),
    run('c', '2026-11-23', 0, 3),
    run('d', '2026-11-23', 0, 3),
  ])
}

async function balance(): Promise<number> {
  const h = await loadHistory(db, 'p')
  return notesBalance(h, bestStarsSum(bestStars(h.attempts)))
}

test('repairStreak writes the records and lowers the balance by the cost', async () => {
  await seed()
  expect(await balance()).toBe(22)
  await repairStreak(db, 'p', 'easy', NOW)
  const repairs = await db.streakRepairs.toArray()
  expect(repairs).toHaveLength(1)
  expect(repairs[0]).toMatchObject({ profileId: 'p', streak: 'easy', day: '2026-11-26', cost: 20, createdAt: NOW })
  expect(repairs[0].id).toMatch(/^[0-9a-f-]{36}$/)
  expect(await balance()).toBe(2)
})

test('repairStreak refuses when there is no offer or not enough notes, and writes nothing', async () => {
  await expect(repairStreak(db, 'p', 'easy', NOW)).rejects.toThrow('noOffer')
  await seed()
  await expect(repairStreak(db, 'p', 'practice', NOW)).rejects.toThrow('notAffordable')
  expect(await db.streakRepairs.count()).toBe(0)
  await repairStreak(db, 'p', 'easy', NOW)
  // The same repair a second time: the offer is gone.
  await expect(repairStreak(db, 'p', 'easy', NOW)).rejects.toThrow('noOffer')
  expect(await db.streakRepairs.count()).toBe(1)
})
