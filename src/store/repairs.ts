// Paying notes (♪) to repair a broken streak (§6.7).
import { localDay } from '../progress/days'
import { repairOffers, repairRecords } from '../progress/notes'
import { bestStars, bestStarsSum } from '../progress/unlocking'
import type { VtDatabase } from './db'
import { loadHistory } from './history'
import type { StreakKind } from './records'

/**
 * Repairs yesterday for `streak`. The offer and the balance are checked again
 * inside the transaction: two offers can both look affordable on screen, and
 * after paying for one the other may no longer be.
 */
export async function repairStreak(
  db: VtDatabase,
  profileId: string,
  streak: StreakKind,
  now: number,
): Promise<void> {
  await db.transaction('rw', db.attempts, db.goalSettings, db.streakRepairs, async () => {
    const h = await loadHistory(db, profileId)
    const offer = repairOffers(h, bestStarsSum(bestStars(h.attempts)), localDay(now)).find(
      (o) => o.streak === streak,
    )
    if (!offer) throw new Error('noOffer')
    if (!offer.affordable) throw new Error('notAffordable')
    await db.streakRepairs.bulkAdd(repairRecords(h, offer, profileId, now, () => crypto.randomUUID()))
  })
}
