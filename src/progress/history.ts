// A profile's history as plain data, and the days it earns (§6.1, §6.2).
// Pure: no storage here, only record types and constants.
import type { Attempt, GoalSetting, StreakKind, StreakRepair } from '../store/records'
import { DEFAULT_GOAL_MINUTES } from '../store/records'
import { localDay, type Day } from './days'

export interface ProfileHistory {
  attempts: readonly Attempt[]
  goals: readonly GoalSetting[]
  repairs: readonly StreakRepair[]
}

/** The goal in force on `day`: the latest setting from that day or before. */
export function goalMinutesOn(goals: readonly GoalSetting[], day: Day): number {
  let best: GoalSetting | null = null
  for (const g of goals) {
    if (g.fromDay > day) continue
    if (
      best === null ||
      g.fromDay > best.fromDay ||
      (g.fromDay === best.fromDay && g.createdAt > best.createdAt)
    ) {
      best = g
    }
  }
  return best ? best.minutes : DEFAULT_GOAL_MINUTES
}

/** Active time per day. A run belongs to the local day it started. */
export function activeMsByDay(attempts: readonly Attempt[]): Map<Day, number> {
  const byDay = new Map<Day, number>()
  for (const a of attempts) {
    const day = localDay(a.startedAt)
    byDay.set(day, (byDay.get(day) ?? 0) + a.activeMs)
  }
  return byDay
}

/** Days whose active minutes reach that day's goal. */
export function goalDays(h: ProfileHistory): Set<Day> {
  const days = new Set<Day>()
  for (const [day, ms] of activeMsByDay(h.attempts)) {
    if (ms >= goalMinutesOn(h.goals, day) * 60_000) days.add(day)
  }
  return days
}

/** Days with a completed run, plus every goal day. */
export function practiceDays(h: ProfileHistory): Set<Day> {
  const days = goalDays(h)
  for (const a of h.attempts) {
    if (a.completed) days.add(localDay(a.startedAt))
  }
  return days
}

export function repairedDays(h: ProfileHistory, streak: StreakKind): Set<Day> {
  return new Set(h.repairs.filter((r) => r.streak === streak).map((r) => r.day))
}

export function completedRunsOn(attempts: readonly Attempt[], days: readonly Day[]): number {
  const wanted = new Set(days)
  return attempts.filter((a) => a.completed && wanted.has(localDay(a.startedAt))).length
}
