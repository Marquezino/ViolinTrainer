import { expect, test } from 'vitest'
import type { Attempt, StreakRepair } from '../store/records'
import type { Day } from './days'
import type { ProfileHistory } from './history'
import {
  EASY_REPAIR_COST,
  NOTES_PER_GOAL_DAY,
  PRACTICE_REPAIR_COST,
  notesBalance,
  repairOffers,
  repairRecords,
} from './notes'

const TODAY = '2026-11-27'
const MIN = 60_000

function at(day: Day, hour: number): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, hour).getTime()
}

function run(day: Day, minutes: number, completed = true): Attempt {
  const startedAt = at(day, 10)
  return {
    id: `a-${day}-${minutes}`,
    profileId: 'p',
    exerciseId: 'builtin:x',
    startedAt,
    finishedAt: completed ? startedAt + minutes * MIN : null,
    completed,
    points: 0,
    maxPoints: 0,
    stars: completed ? 1 : 0,
    activeMs: minutes * MIN,
    results: [],
  }
}

function repair(streak: 'easy' | 'practice', day: Day, cost: number): StreakRepair {
  return { id: `r-${streak}-${day}`, profileId: 'p', streak, day, cost, createdAt: 0 }
}

const ids = () => {
  let n = 0
  return () => `id${n++}`
}

test('constants', () => {
  expect([NOTES_PER_GOAL_DAY, EASY_REPAIR_COST, PRACTICE_REPAIR_COST]).toEqual([5, 20, 40])
})

test('balance: 5 per goal day plus best stars minus repairs', () => {
  const h: ProfileHistory = {
    attempts: [run('2026-11-20', 10), run('2026-11-21', 10), run('2026-11-22', 15), run('2026-11-23', 3)],
    goals: [],
    repairs: [repair('easy', '2026-11-19', 20)],
  }
  expect(notesBalance(h, 4)).toBe(5 * 3 + 4 - 20)
})

// Goal days 20 and 23, then 24, 25, 26 missed for both streaks: both offers
// are open today. Plenty of notes: 2 goal days = 10, plus 100 best stars.
const brokenBoth: ProfileHistory = {
  attempts: [run('2026-11-20', 10), run('2026-11-23', 10)],
  goals: [],
  repairs: [],
}

test('offers: practice first, with what they restore', () => {
  const offers = repairOffers(brokenBoth, 100, TODAY)
  expect(offers).toEqual([
    { streak: 'practice', day: '2026-11-26', cost: 40, restores: 2, affordable: true, missing: 0 },
    { streak: 'easy', day: '2026-11-26', cost: 20, restores: 2, affordable: true, missing: 0 },
  ])
  expect(repairOffers(brokenBoth, 100, '2026-11-28')).toEqual([])
  expect(repairOffers({ attempts: [], goals: [], repairs: [] }, 100, TODAY)).toEqual([])
})

test('practice repair also repairs the easy streak unless that day was a practice day', () => {
  const [practice] = repairOffers(brokenBoth, 100, TODAY)
  const records = repairRecords(brokenBoth, practice, 'p', 1234, ids())
  expect(records).toEqual([
    { id: 'id0', profileId: 'p', streak: 'practice', day: '2026-11-26', cost: 40, createdAt: 1234 },
    { id: 'id1', profileId: 'p', streak: 'easy', day: '2026-11-26', cost: 0, createdAt: 1234 },
  ])
  // After it, neither streak is offered for repair and both are restored.
  const repaired = { ...brokenBoth, repairs: records }
  expect(repairOffers(repaired, 100, TODAY)).toEqual([])
  expect(notesBalance(repaired, 100)).toBe(10 + 100 - 40)

  // Yesterday had a completed run, but not the goal: only the practice streak broke.
  const easyKept: ProfileHistory = { ...brokenBoth, attempts: [...brokenBoth.attempts, run('2026-11-26', 2)] }
  const offers = repairOffers(easyKept, 100, TODAY)
  expect(offers.map((o) => o.streak)).toEqual(['practice'])
  expect(repairRecords(easyKept, offers[0], 'p', 1234, ids())).toEqual([
    { id: 'id0', profileId: 'p', streak: 'practice', day: '2026-11-26', cost: 40, createdAt: 1234 },
  ])
})

test('an easy repair gives one record and leaves the practice offer open', () => {
  const offers = repairOffers(brokenBoth, 100, TODAY)
  const easy = offers.find((o) => o.streak === 'easy')!
  const records = repairRecords(brokenBoth, easy, 'p', 5, ids())
  expect(records).toEqual([
    { id: 'id0', profileId: 'p', streak: 'easy', day: '2026-11-26', cost: 20, createdAt: 5 },
  ])
  const after = { ...brokenBoth, repairs: records }
  expect(repairOffers(after, 100, TODAY).map((o) => o.streak)).toEqual(['practice'])
})

test('offer is not affordable with too few notes and says how many are missing', () => {
  // 2 goal days = 10 notes, plus 5 best stars = 15.
  expect(notesBalance(brokenBoth, 5)).toBe(15)
  const offers = repairOffers(brokenBoth, 5, TODAY)
  const easy = offers.find((o) => o.streak === 'easy')!
  expect(easy).toMatchObject({ affordable: false, missing: 5 })
  expect(offers.find((o) => o.streak === 'practice')).toMatchObject({ affordable: false, missing: 25 })
  // Exactly enough is affordable.
  expect(repairOffers(brokenBoth, 10, TODAY).find((o) => o.streak === 'easy')).toMatchObject({
    affordable: true,
    missing: 0,
  })
})
