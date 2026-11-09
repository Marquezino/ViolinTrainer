import type { TargetState } from './wait-session'

export type Stars = 0 | 1 | 2 | 3

export interface RunResult {
  points: number
  maxPoints: number
  stars: Stars
}

/** Green 2, yellow 1; a target accepted after a red attempt earns at most 1. */
export function targetPoints(t: TargetState): number {
  if (t.color === null) return 0
  const base = t.color === 'green' ? 2 : 1
  return t.redAttempts > 0 ? Math.min(base, 1) : base
}

/** Stars: 3 at >= 90% of the points, 2 at >= 70%, 1 for finishing; 0 when not finished. */
export function scoreRun(targets: readonly TargetState[], completed: boolean): RunResult {
  const points = targets.reduce((sum, t) => sum + targetPoints(t), 0)
  const maxPoints = 2 * targets.length
  let stars: Stars = 0
  if (completed) {
    // Integer comparisons avoid floating-point edge cases at exactly 90% and 70%.
    if (points * 10 >= maxPoints * 9) stars = 3
    else if (points * 10 >= maxPoints * 7) stars = 2
    else stars = 1
  }
  return { points, maxPoints, stars }
}
