import type { Stars } from '../practice/scoring'
import type { StreakKind } from '../store/records'

/** Streak lengths, in days, that get a celebration. */
export const STREAK_MILESTONES = [7, 30, 100, 365] as const

/** What the rules need to know before and after a run. `bestStars` is the best on the exercise just played. */
export interface ProgressSummary {
  todayActiveMs: number
  goalMs: number
  easy: number
  practice: number
  bestStars: Stars
}

export type Celebration =
  | { kind: 'goalReached' }
  | { kind: 'streakMilestone'; streak: StreakKind; days: number }
  | { kind: 'newBestStars'; stars: Stars }

/** What to celebrate after a run: the goal crossed, a streak milestone crossed, a new best. */
export function celebrationsFor(before: ProgressSummary, after: ProgressSummary): Celebration[] {
  const out: Celebration[] = []
  if (before.todayActiveMs < before.goalMs && after.todayActiveMs >= after.goalMs) {
    out.push({ kind: 'goalReached' })
  }
  for (const streak of ['easy', 'practice'] as const) {
    // At most one per streak: the highest milestone crossed.
    const crossed = STREAK_MILESTONES.filter((m) => before[streak] < m && m <= after[streak])
    if (crossed.length > 0) {
      out.push({ kind: 'streakMilestone', streak, days: crossed[crossed.length - 1] })
    }
  }
  if (after.bestStars > before.bestStars) out.push({ kind: 'newBestStars', stars: after.bestStars })
  return out
}

/** For the banner during a run: true once today's time, with the run so far, reaches the goal. */
export function goalJustReached(beforeRunMs: number, liveActiveMs: number, goalMs: number): boolean {
  return beforeRunMs < goalMs && beforeRunMs + liveActiveMs >= goalMs
}
