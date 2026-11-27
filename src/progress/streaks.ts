// The two streaks and their shared gap rule (§6). A day is counting (a
// practice day or a goal day, depending on the streak), repaired, or missed.
import { addDays, type Day } from './days'
import { goalDays, practiceDays, repairedDays, type ProfileHistory } from './history'

export const MAX_MISSED_IN_A_ROW = 2

/**
 * Counting days in the stretch that reaches back from today while no more
 * than MAX_MISSED_IN_A_ROW days in a row are missed. Today is skipped, not
 * missed, until it counts. Repaired days end a miss run but don't add.
 */
export function streakLength(
  counting: ReadonlySet<Day>,
  repaired: ReadonlySet<Day>,
  today: Day,
): number {
  let earliest: Day | null = null
  for (const d of [...counting, ...repaired]) {
    if (earliest === null || d < earliest) earliest = d
  }
  if (earliest === null) return 0

  let length = 0
  let missedInARow = 0
  for (let d = counting.has(today) ? today : addDays(today, -1); d >= earliest; d = addDays(d, -1)) {
    if (counting.has(d)) {
      length++
      missedInARow = 0
    } else if (repaired.has(d)) {
      missedInARow = 0
    } else if (++missedInARow > MAX_MISSED_IN_A_ROW) {
      break
    }
  }
  return length
}

/**
 * When yesterday was the 3rd missed day in a row (and the day before those
 * three was not missed, so the break is fresh), the streak a repair of
 * yesterday would restore. Otherwise null, as it is when nothing would be
 * restored.
 */
export function brokenYesterday(
  counting: ReadonlySet<Day>,
  repaired: ReadonlySet<Day>,
  today: Day,
): number | null {
  const missed = (d: Day) => !counting.has(d) && !repaired.has(d)
  const yesterday = addDays(today, -1)
  for (let i = 1; i <= MAX_MISSED_IN_A_ROW + 1; i++) {
    if (!missed(addDays(today, -i))) return null
  }
  if (missed(addDays(today, -(MAX_MISSED_IN_A_ROW + 2)))) return null
  const restores = streakLength(counting, new Set([...repaired, yesterday]), today)
  return restores > 0 ? restores : null
}

export function streaks(h: ProfileHistory, today: Day): { easy: number; practice: number } {
  return {
    easy: streakLength(practiceDays(h), repairedDays(h, 'easy'), today),
    practice: streakLength(goalDays(h), repairedDays(h, 'practice'), today),
  }
}
