// Saving practice runs (§4.2). A run is put while open (checkpoints) and
// closed once; a closed attempt is never modified again, and hint states are
// updated only by the close that closes it.
import type { EngineSnapshot } from '../practice/engine'
import { scoreRun } from '../practice/scoring'
import { hintCounts, updateHintCounts } from '../progress/hints'
import type { Exercise } from '../score/exercise'
import type { VtDatabase } from './db'
import { updateSettings } from './profiles'
import type { Attempt, HintState, TargetResult } from './records'

export function attemptFrom(input: {
  id: string
  profileId: string
  exerciseId: string
  startedAt: number
  snapshot: EngineSnapshot
  finishedAt: number | null
}): Attempt {
  const { snapshot } = input
  const completed = snapshot.phase === 'finished'
  const { points, maxPoints, stars } = scoreRun(snapshot.session.targets, completed)
  // targetId is the index in exercise.targets: updateHintCounts relies on it.
  const results: TargetResult[] = []
  snapshot.session.targets.forEach((t, i) => {
    if (t.color === null && t.redAttempts === 0) return
    results.push({ targetId: i, color: t.color, redAttempts: t.redAttempts, centsAtAcceptance: t.centsAtAcceptance })
  })
  return {
    id: input.id,
    profileId: input.profileId,
    exerciseId: input.exerciseId,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    completed,
    points,
    maxPoints,
    stars,
    activeMs: snapshot.activeMs,
    results,
  }
}

/** Whether anything was played: runs without it are not saved. */
export function hasPlayableContent(snapshot: EngineSnapshot): boolean {
  return snapshot.activeMs > 0 || snapshot.session.targets.some((t) => t.color !== null || t.redAttempts > 0)
}

/** Saves an open run, e.g. when the tablet goes to sleep. Ignored once the run is closed. */
export async function checkpointRun(db: VtDatabase, attempt: Attempt): Promise<void> {
  await db.transaction('rw', db.attempts, async () => {
    const stored = await db.attempts.get(attempt.id)
    if (stored && stored.finishedAt !== null) return
    await db.attempts.put({ ...attempt, finishedAt: null })
  })
}

/**
 * Closes a run: saves it with `finishedAt`, updates the profile's hint states
 * and remembers the profile. Does nothing if the run is already closed, so a
 * second close never counts the hints twice.
 */
export async function closeRun(db: VtDatabase, attempt: Attempt, exercise: Exercise): Promise<void> {
  if (attempt.finishedAt === null) throw new Error('closeRun needs finishedAt')
  const now = attempt.finishedAt
  await db.transaction('rw', db.attempts, db.hintStates, db.settings, async () => {
    const stored = await db.attempts.get(attempt.id)
    if (stored && stored.finishedAt !== null) return
    await db.attempts.put(attempt)

    const states = await db.hintStates.where('profileId').equals(attempt.profileId).toArray()
    const before = hintCounts(states)
    const after = updateHintCounts(exercise, attempt.results, before)
    const changed: HintState[] = []
    for (const [noteKey, count] of after) {
      if (before.get(noteKey) === count) continue
      changed.push({ profileId: attempt.profileId, noteKey, consecutiveFirstTryGreens: count, updatedAt: now })
    }
    await db.hintStates.bulkPut(changed)

    await updateSettings(db, { lastProfileId: attempt.profileId })
  })
}
