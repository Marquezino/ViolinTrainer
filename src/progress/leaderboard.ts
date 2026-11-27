// The weekly family leaderboard: it ranks effort, never skill (§6.4).
// Stars do not enter. Pure.
import { daysOfWeek, type Day } from './days'
import { completedRunsOn, goalDays, type ProfileHistory } from './history'

export interface LeaderboardRow {
  profileId: string
  place: number
  goalDays: number
  completedRuns: number
  /** Monday to Sunday: whether each day was a goal day. */
  week: boolean[]
}

export function weeklyLeaderboard(
  entries: readonly { profileId: string; history: ProfileHistory }[],
  today: Day,
): LeaderboardRow[] {
  const days = daysOfWeek(today)
  const rows = entries.map(({ profileId, history }) => {
    const goals = goalDays(history)
    const week = days.map((d) => goals.has(d))
    return {
      profileId,
      place: 0,
      goalDays: week.filter(Boolean).length,
      completedRuns: completedRunsOn(history.attempts, days),
      week,
    }
  })
  rows.sort((a, b) => b.goalDays - a.goalDays || b.completedRuns - a.completedRuns)
  rows.forEach((r, i) => {
    const prev = rows[i - 1]
    r.place =
      prev && prev.goalDays === r.goalDays && prev.completedRuns === r.completedRuns
        ? prev.place
        : i + 1
  })
  return rows
}
