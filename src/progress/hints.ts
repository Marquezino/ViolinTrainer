import { noteKey } from '../music/fingering'
import type { Exercise, Target } from '../score/exercise'
import type { HintState, TargetResult } from '../store/records'

/** A note is learned, and its fingering hint hidden, after this many first-try greens in a row. */
export const LEARNED_AFTER = 5

/** Stored hint states of one profile as noteKey -> consecutive first-try greens. */
export function hintCounts(states: readonly HintState[]): Map<string, number> {
  return new Map(states.map((s) => [s.noteKey, s.consecutiveFirstTryGreens]))
}

/**
 * Counts after a run, as a new map. A red attempt resets the note; a green with no red attempt adds
 * one; yellow, and targets never reached, change nothing. Notes outside first position have no
 * hint and are skipped.
 */
export function updateHintCounts(
  exercise: Exercise,
  results: readonly TargetResult[],
  counts: Map<string, number>,
): Map<string, number> {
  const next = new Map(counts)
  const byTarget = new Map(results.map((r) => [r.targetId, r]))
  for (const target of exercise.targets) {
    if (target.fingering === null) continue
    const result = byTarget.get(target.index)
    if (!result) continue
    const key = noteKey(target.midi, target.fingering)
    if (result.redAttempts > 0) next.set(key, 0)
    else if (result.color === 'green') next.set(key, (next.get(key) ?? 0) + 1)
  }
  return next
}

/** For `SessionConfig.initialHint`: show the hint unless the note is learned. */
export function initialHintFor(counts: Map<string, number>): (target: Target) => boolean {
  return (target) => {
    if (target.fingering === null) return true
    return (counts.get(noteKey(target.midi, target.fingering)) ?? 0) < LEARNED_AFTER
  }
}
