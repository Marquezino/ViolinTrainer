import { expect, test } from 'vitest'
import fc from 'fast-check'
import type { Attempt, GoalSetting, StreakRepair } from '../store/records'
import { addDays, type Day } from './days'
import type { ProfileHistory } from './history'
import { repairOffers, repairRecords } from './notes'
import { brokenYesterday, streakLength, streaks } from './streaks'

const TODAY = '2026-11-27' // a Friday
const none = new Set<Day>()
const days = (...list: Day[]): Set<Day> => new Set(list)

test('spec example: Mon ✓ Tue ✗ Wed ✗ Thu ✗ Fri ✓ gives 1', () => {
  expect(streakLength(days('2026-11-23', '2026-11-27'), none, TODAY)).toBe(1)
  // With Wednesday practised instead, the stretch reaches back to Monday.
  expect(streakLength(days('2026-11-23', '2026-11-25', '2026-11-27'), none, TODAY)).toBe(3)
})

test('two misses in a row are forgiven', () => {
  expect(streakLength(days('2026-11-23', '2026-11-26', '2026-11-27'), none, TODAY)).toBe(3)
})

test('today not yet practised is skipped, not missed', () => {
  expect(streakLength(days('2026-11-24', '2026-11-25', '2026-11-26'), none, TODAY)).toBe(3)
  // Yesterday and the day before missed, today not yet: still alive.
  expect(streakLength(days('2026-11-24'), none, TODAY)).toBe(1)
  // Three days missed before today: broken, even though today is skipped.
  expect(streakLength(days('2026-11-23'), none, TODAY)).toBe(0)
})

test('a repaired day stops a miss run but does not add', () => {
  expect(streakLength(days('2026-11-21', '2026-11-27'), days('2026-11-24'), TODAY)).toBe(2)
  expect(streakLength(none, days('2026-11-26'), TODAY)).toBe(0)
})

test('no history is 0', () => {
  expect(streakLength(none, none, TODAY)).toBe(0)
  const empty: ProfileHistory = { attempts: [], goals: [], repairs: [] }
  expect(streaks(empty, TODAY)).toEqual({ easy: 0, practice: 0 })
})

test('streaks cross DST and month ends', () => {
  const daily = new Set<Day>()
  for (let d = '2026-10-25'; d <= '2026-11-03'; d = addDays(d, 1)) daily.add(d)
  expect(daily.size).toBe(10)
  expect(streakLength(daily, none, '2026-11-03')).toBe(10)
})

test('brokenYesterday offers only the day after the 3rd miss', () => {
  const counting = days('2026-11-20', '2026-11-23') // missed 24, 25, 26
  expect(brokenYesterday(counting, none, '2026-11-27')).toBe(2)
  expect(brokenYesterday(counting, none, '2026-11-28')).toBeNull()
  expect(brokenYesterday(days('2026-11-25'), none, '2026-11-27')).toBeNull()
  // Practising today does not take the offer away.
  expect(brokenYesterday(days('2026-11-23', '2026-11-27'), none, TODAY)).toBe(2)
  // Already repaired: nothing to offer.
  expect(brokenYesterday(counting, days('2026-11-26'), TODAY)).toBeNull()
  // A repaired day before the misses carries the old stretch.
  expect(brokenYesterday(days('2026-11-21'), days('2026-11-23'), TODAY)).toBe(1)
  // No history at all.
  expect(brokenYesterday(none, none, TODAY)).toBeNull()
})

test('brokenYesterday is null after a 4th or later miss', () => {
  // 23, 24, 25, 26 missed: the streak broke on the 25th, so the offer was on the 26th.
  expect(brokenYesterday(days('2026-11-22'), none, TODAY)).toBeNull()
  expect(brokenYesterday(days('2026-11-22', '2026-11-27'), none, TODAY)).toBeNull()
})

// ---- property ----

const START: Day = '2026-10-01' // the 60 days cross the US fall-back change
const SPAN = 60
const MIN = 60_000

function at(day: Day, hour: number): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, hour).getTime()
}

type DayKind = 'none' | 'completed' | 'goal'

const dayArb = fc.record({
  kind: fc.constantFrom<DayKind>('none', 'completed', 'goal'),
  completed: fc.boolean(), // for a goal day: whether its long run was finished
  takeRepairs: fc.boolean(),
})

const goalArb = fc.record({
  offset: fc.integer({ min: -5, max: SPAN }),
  minutes: fc.integer({ min: 1, max: 12 }).map((n) => n * 5),
})

function buildAttempts(kinds: { kind: DayKind; completed: boolean }[]): Attempt[] {
  const attempts: Attempt[] = []
  kinds.forEach(({ kind, completed }, i) => {
    if (kind === 'none') return
    const day = addDays(START, i)
    const isGoal = kind === 'goal'
    const startedAt = at(day, 23) // late, so a wrong day split would show
    attempts.push({
      id: `a${i}`,
      profileId: 'p',
      exerciseId: 'builtin:x',
      startedAt,
      finishedAt: isGoal && !completed ? null : startedAt + MIN,
      completed: isGoal ? completed : true,
      points: 0,
      maxPoints: 0,
      stars: 0,
      activeMs: isGoal ? 60 * MIN : 4 * MIN, // 60 meets any goal; 4 meets none
      results: [],
    })
  })
  return attempts
}

test('property: easy streak >= practice streak', () => {
  fc.assert(
    fc.property(
      fc.array(dayArb, { minLength: SPAN, maxLength: SPAN }),
      fc.array(goalArb, { maxLength: 4 }),
      fc.integer({ min: 0, max: 400 }),
      (dayList, goalList, bestStarsSum) => {
        const allAttempts = buildAttempts(dayList)
        const goals: GoalSetting[] = goalList.map((g, i) => ({
          id: `g${i}`,
          profileId: 'p',
          minutes: g.minutes,
          fromDay: addDays(START, g.offset),
          createdAt: i,
        }))
        const repairs: StreakRepair[] = []
        let next = 0
        for (let i = 0; i < SPAN; i++) {
          const today = addDays(START, i)
          const end = at(addDays(today, 1), 0)
          const h: ProfileHistory = {
            attempts: allAttempts.filter((a) => a.startedAt < end),
            goals,
            repairs: [...repairs],
          }
          const s = streaks(h, today)
          expect(s.easy).toBeGreaterThanOrEqual(s.practice)
          if (!dayList[i].takeRepairs) continue
          for (const offer of repairOffers(h, bestStarsSum, today)) {
            if (!offer.affordable) continue
            const current: ProfileHistory = { ...h, repairs: [...repairs] }
            // Take each offer only while it is still offered.
            const still = repairOffers(current, bestStarsSum, today).find((o) => o.streak === offer.streak)
            if (!still?.affordable) continue
            repairs.push(...repairRecords(current, still, 'p', i, () => `r${next++}`))
            const after = streaks({ ...h, repairs: [...repairs] }, today)
            expect(after.easy).toBeGreaterThanOrEqual(after.practice)
          }
        }
      },
    ),
    { numRuns: 200 },
  )
})
