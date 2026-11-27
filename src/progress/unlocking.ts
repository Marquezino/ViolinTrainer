// Which exercises a child may play, and which one to suggest next (§6.5).
// Pure. Unlocking never relocks: any attempt keeps an exercise open.
import type { Attempt } from '../store/records'
import type { Stars } from '../practice/scoring'

/** Best stars needed on an exercise to open the next one. */
export const UNLOCK_STARS = 2

/** Best stars per exercise, from completed attempts only. */
export function bestStars(attempts: readonly Attempt[]): Map<string, Stars> {
  const best = new Map<string, Stars>()
  for (const a of attempts) {
    if (!a.completed) continue
    if (a.stars > (best.get(a.exerciseId) ?? 0) || !best.has(a.exerciseId)) {
      best.set(a.exerciseId, a.stars)
    }
  }
  return best
}

export function bestStarsSum(best: Map<string, Stars>): number {
  let sum = 0
  for (const s of best.values()) sum += s
  return sum
}

/** `path` is the visible exercise ids in order, deleted ones left out. */
export function unlockedExercises(
  path: readonly string[],
  attempts: readonly Attempt[],
  manualUnlocks: readonly string[],
): Set<string> {
  const best = bestStars(attempts)
  const played = new Set(attempts.map((a) => a.exerciseId))
  const manual = new Set(manualUnlocks)
  const unlocked = new Set<string>()
  path.forEach((id, i) => {
    if (
      i === 0 ||
      (best.get(path[i - 1]) ?? 0) >= UNLOCK_STARS ||
      played.has(id) ||
      manual.has(id)
    ) {
      unlocked.add(id)
    }
  })
  return unlocked
}

/** The first unlocked exercise not yet at 2 stars, else the last unlocked one. */
export function nextToPlay(
  path: readonly string[],
  unlocked: ReadonlySet<string>,
  best: ReadonlyMap<string, Stars>,
): string | null {
  let last: string | null = null
  for (const id of path) {
    if (!unlocked.has(id)) continue
    if ((best.get(id) ?? 0) < UNLOCK_STARS) return id
    last = id
  }
  return last
}
