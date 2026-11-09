import { judge, type Judgement, type Tolerances } from '../music/pitch'
import type { Exercise, Target } from '../score/exercise'

export type TargetColor = 'green' | 'yellow'

export interface TargetState {
  color: TargetColor | null
  redAttempts: number
  centsAtAcceptance: number | null
  hintVisible: boolean
}

export interface SessionConfig {
  tolerances: Tolerances
  a4Hz: number
  /** Show the hint when the current target is not accepted within this time. */
  hintDelayMs: number
  /** Whether a target's hint is visible at the start (later: false for learned notes). */
  initialHint: (target: Target) => boolean
}

export const DEFAULT_HINT_DELAY_MS = 5000

export interface WaitSessionState {
  exercise: Exercise
  config: SessionConfig
  cursor: number
  targets: TargetState[]
  /** When the current target became current (audio clock, ms). */
  activeSinceMs: number
  finished: boolean
}

export type SessionEvent =
  | { type: 'accepted'; index: number; color: TargetColor; judgement: Judgement }
  | { type: 'rejected'; index: number; judgement: Judgement }
  | { type: 'hintShown'; index: number }
  | { type: 'finished' }

export interface Step {
  state: WaitSessionState
  events: SessionEvent[]
}

export function startSession(exercise: Exercise, config: SessionConfig, nowMs: number): WaitSessionState {
  return {
    exercise,
    config,
    cursor: 0,
    targets: exercise.targets.map((t) => ({
      color: null,
      redAttempts: 0,
      centsAtAcceptance: null,
      hintVisible: t.fingering !== null && config.initialHint(t),
    })),
    activeSinceMs: nowMs,
    finished: false,
  }
}

/** A confirmed note from the note tracker. */
export function onNote(state: WaitSessionState, note: { hz: number; timeMs: number }): Step {
  if (state.finished) return { state, events: [] }
  const index = state.cursor
  const target = state.exercise.targets[index]
  const current = state.targets[index]
  const judgement = judge(note.hz, target.midi, state.config.tolerances, state.config.a4Hz)
  const targets = [...state.targets]

  if (judgement.kind === 'green' || judgement.kind === 'yellow') {
    targets[index] = { ...current, color: judgement.kind, centsAtAcceptance: judgement.cents }
    const cursor = index + 1
    const finished = cursor === state.exercise.targets.length
    const events: SessionEvent[] = [{ type: 'accepted', index, color: judgement.kind, judgement }]
    if (finished) events.push({ type: 'finished' })
    return { state: { ...state, targets, cursor, finished, activeSinceMs: note.timeMs }, events }
  }

  const events: SessionEvent[] = [{ type: 'rejected', index, judgement }]
  const showHint = target.fingering !== null && !current.hintVisible
  targets[index] = { ...current, redAttempts: current.redAttempts + 1, hintVisible: current.hintVisible || showHint }
  if (showHint) events.push({ type: 'hintShown', index })
  return { state: { ...state, targets }, events }
}

/** Called regularly with the audio clock; reveals the hint after the delay. */
export function onTick(state: WaitSessionState, nowMs: number): Step {
  if (state.finished) return { state, events: [] }
  const index = state.cursor
  const current = state.targets[index]
  const hasHint = state.exercise.targets[index].fingering !== null
  if (current.hintVisible || !hasHint || nowMs - state.activeSinceMs < state.config.hintDelayMs) {
    return { state, events: [] }
  }
  const targets = [...state.targets]
  targets[index] = { ...current, hintVisible: true }
  return { state: { ...state, targets }, events: [{ type: 'hintShown', index }] }
}
