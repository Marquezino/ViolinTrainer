// Notes (♪) and streak repairs (§6.7). Earnings are computed, never stored;
// only repairs are stored, as add-only StreakRepair records.
import type { StreakKind, StreakRepair } from '../store/records'
import { addDays, type Day } from './days'
import { goalDays, practiceDays, repairedDays, type ProfileHistory } from './history'
import { brokenYesterday } from './streaks'

export const NOTES_PER_GOAL_DAY = 5
export const EASY_REPAIR_COST = 20
export const PRACTICE_REPAIR_COST = 40

/** `bestStarsSum` is the sum of best stars over all exercises (1 ♪ each). */
export function notesBalance(h: ProfileHistory, bestStarsSum: number): number {
  const spent = h.repairs.reduce((sum, r) => sum + r.cost, 0)
  return NOTES_PER_GOAL_DAY * goalDays(h).size + bestStarsSum - spent
}

export interface RepairOffer {
  streak: StreakKind
  day: Day
  cost: number
  restores: number
  affordable: boolean
  missing: number
}

/** Repairs open today, practice first. Each is priced against the whole balance. */
export function repairOffers(h: ProfileHistory, bestStarsSum: number, today: Day): RepairOffer[] {
  const balance = notesBalance(h, bestStarsSum)
  const kinds: [StreakKind, ReadonlySet<Day>, number][] = [
    ['practice', goalDays(h), PRACTICE_REPAIR_COST],
    ['easy', practiceDays(h), EASY_REPAIR_COST],
  ]
  const offers: RepairOffer[] = []
  for (const [streak, counting, cost] of kinds) {
    const restores = brokenYesterday(counting, repairedDays(h, streak), today)
    if (restores === null) continue
    offers.push({
      streak,
      day: addDays(today, -1),
      cost,
      restores,
      affordable: balance >= cost,
      missing: Math.max(0, cost - balance),
    })
  }
  return offers
}

/**
 * The records that carry out an offer. A practice repair also repairs the
 * easy streak for free, unless that day already counts for it, so the easy
 * streak never falls below the practice streak. The caller checks that the
 * offer is still open and affordable.
 */
export function repairRecords(
  h: ProfileHistory,
  offer: RepairOffer,
  profileId: string,
  now: number,
  newId: () => string,
): StreakRepair[] {
  const record = (streak: StreakKind, cost: number): StreakRepair => ({
    id: newId(),
    profileId,
    streak,
    day: offer.day,
    cost,
    createdAt: now,
  })
  if (offer.streak === 'easy') return [record('easy', EASY_REPAIR_COST)]
  const records = [record('practice', PRACTICE_REPAIR_COST)]
  if (!practiceDays(h).has(offer.day) && !repairedDays(h, 'easy').has(offer.day)) {
    records.push(record('easy', 0))
  }
  return records
}
