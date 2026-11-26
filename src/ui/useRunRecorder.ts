import { useEffect, useRef } from 'react'
import type { EngineSnapshot } from '../practice/engine'
import type { Exercise } from '../score/exercise'
import type { VtDatabase } from '../store/db'
import { attemptFrom, checkpointRun, closeRun, hasPlayableContent } from '../store/runs'

export interface RunRecorderParams {
  db: VtDatabase
  profileId: string
  exerciseId: string
  exercise: Exercise
  snapshot: EngineSnapshot | null
}

interface OpenRun {
  id: string
  /** Who played what, fixed when the run began. */
  owner: Omit<RunRecorderParams, 'snapshot'>
  /** Wall-clock time: the run belongs to the local day it started. */
  startedAt: number
  closed: boolean
  /** The last snapshot of this run; after a restart, params.snapshot already belongs to the next one. */
  snapshot: EngineSnapshot
}

function report(e: unknown): void {
  console.error('Saving the run failed', e)
}

/**
 * Saves the practice run shown by `snapshot`: closed when it finishes, when
 * the player leaves or when it restarts, and checkpointed when the page is
 * hidden (the tablet sleeps or the app is switched away), so its minutes
 * survive even if the page never comes back. Runs with nothing played are
 * not saved.
 */
export function useRunRecorder(params: RunRecorderParams): void {
  const run = useRef<OpenRun | null>(null)
  const { db, profileId, exerciseId, exercise, snapshot } = params

  useEffect(() => {
    if (!snapshot) return
    if (snapshot.phase === 'measuringNoise' || snapshot.phase === 'tooNoisy') {
      // A restart ("Play again") begins with a new room check: the previous run ends here.
      closeCurrent(run.current)
      run.current = null
      return
    }
    run.current ??= {
      id: crypto.randomUUID(),
      owner: { db, profileId, exerciseId, exercise },
      startedAt: Date.now(),
      closed: false,
      snapshot,
    }
    run.current.snapshot = snapshot
    if (snapshot.phase === 'finished') closeCurrent(run.current)
    // Only a new snapshot moves the run along; the owner is fixed when it begins.
  }, [snapshot])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return
      const open = run.current
      if (!open || open.closed || !hasPlayableContent(open.snapshot)) return
      checkpointRun(open.owner.db, attempt(open, null)).catch(report)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      // The player left: keep what was played so far.
      closeCurrent(run.current)
    }
  }, [])
}

function attempt(open: OpenRun, finishedAt: number | null) {
  const { profileId, exerciseId } = open.owner
  return attemptFrom({ id: open.id, profileId, exerciseId, startedAt: open.startedAt, snapshot: open.snapshot, finishedAt })
}

/** Closes the run once, with its last snapshot, if anything was played. */
function closeCurrent(open: OpenRun | null): void {
  if (!open || open.closed || !hasPlayableContent(open.snapshot)) return
  open.closed = true
  closeRun(open.owner.db, attempt(open, Date.now()), open.owner.exercise).catch(report)
}
