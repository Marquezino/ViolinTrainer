import { expect, test } from 'vitest'
import type { Attempt, GoalSetting } from '../store/records'
import { DEFAULT_GOAL_MINUTES } from '../store/records'
import type { Day } from './days'
import {
  activeMsByDay,
  completedRunsOn,
  goalDays,
  goalMinutesOn,
  practiceDays,
  type ProfileHistory,
} from './history'

// Tests run in America/New_York (vite.config.ts).
const MIN = 60_000

function at(day: Day, hour: number, minute = 0): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, hour, minute).getTime()
}

function attempt(startedAt: number, activeMs: number, completed = true): Attempt {
  return {
    id: `a-${startedAt}-${activeMs}`,
    profileId: 'p',
    exerciseId: 'builtin:x',
    startedAt,
    finishedAt: completed ? startedAt + activeMs : null,
    completed,
    points: 0,
    maxPoints: 0,
    stars: completed ? 1 : 0,
    activeMs,
    results: [],
  }
}

function goal(minutes: number, fromDay: Day, createdAt = 0): GoalSetting {
  return { id: `g-${fromDay}-${minutes}`, profileId: 'p', minutes, fromDay, createdAt }
}

const history = (attempts: Attempt[], goals: GoalSetting[] = []): ProfileHistory => ({
  attempts,
  goals,
  repairs: [],
})

test('a run that starts at 23:58 counts for that day', () => {
  const late = attempt(at('2026-11-26', 23, 58), 12 * MIN)
  expect([...activeMsByDay([late])]).toEqual([['2026-11-26', 12 * MIN]])
  const h = history([late])
  expect(goalDays(h)).toEqual(new Set(['2026-11-26']))
  expect(practiceDays(h)).toEqual(new Set(['2026-11-26']))
  expect(completedRunsOn([late], ['2026-11-27'])).toBe(0)
  expect(completedRunsOn([late], ['2026-11-26'])).toBe(1)
})

test('goal changes apply from their day on; past days keep their goal', () => {
  const goals = [goal(20, '2026-11-25'), goal(5, '2026-11-01')]
  expect(goalMinutesOn([], '2026-11-25')).toBe(DEFAULT_GOAL_MINUTES)
  expect(goalMinutesOn(goals, '2026-10-31')).toBe(DEFAULT_GOAL_MINUTES)
  expect(goalMinutesOn(goals, '2026-11-01')).toBe(5)
  expect(goalMinutesOn(goals, '2026-11-24')).toBe(5)
  expect(goalMinutesOn(goals, '2026-11-25')).toBe(20)
  expect(goalMinutesOn(goals, '2026-12-31')).toBe(20)
  // Two settings on the same day: the one created last wins.
  expect(goalMinutesOn([goal(30, '2026-11-25', 2), ...goals], '2026-11-26')).toBe(30)

  const h = history(
    [
      attempt(at('2026-10-31', 10), 9 * MIN), // goal 10: missed
      attempt(at('2026-11-24', 10), 6 * MIN), // goal 5: reached
      attempt(at('2026-11-25', 10), 6 * MIN), // goal 20: missed
      attempt(at('2026-11-26', 10), 10 * MIN),
      attempt(at('2026-11-26', 18), 10 * MIN), // two runs add up to 20
    ],
    goals,
  )
  expect(goalDays(h)).toEqual(new Set(['2026-11-24', '2026-11-26']))
})

test('an unfinished run counts toward minutes but not as a completed run', () => {
  const unfinished = attempt(at('2026-11-26', 10), 7 * MIN, false)
  const finished = attempt(at('2026-11-26', 11), 3 * MIN)
  expect(activeMsByDay([unfinished, finished]).get('2026-11-26')).toBe(10 * MIN)
  expect(completedRunsOn([unfinished, finished], ['2026-11-26'])).toBe(1)
  expect(goalDays(history([unfinished, finished]))).toEqual(new Set(['2026-11-26']))
  // An unfinished run alone, short of the goal, is not a practice day.
  expect(practiceDays(history([unfinished]))).toEqual(new Set())
})

test('a goal day is a practice day even with no completed run', () => {
  const h = history([attempt(at('2026-11-26', 10), 10 * MIN, false)])
  expect(goalDays(h)).toEqual(new Set(['2026-11-26']))
  expect(practiceDays(h)).toEqual(new Set(['2026-11-26']))
})

test('completedRunsOn counts runs on any of the given days', () => {
  const attempts = [
    attempt(at('2026-11-23', 9), MIN),
    attempt(at('2026-11-23', 10), MIN),
    attempt(at('2026-11-24', 10), MIN, false),
    attempt(at('2026-11-29', 23, 59), MIN),
    attempt(at('2026-11-30', 0, 1), MIN),
  ]
  const week = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']
  expect(completedRunsOn(attempts, week)).toBe(3)
})
