// The built-in units. Ids are fixed so a new app version can update a unit in
// place: bump `version` whenever its exercise list changes.
import { SAMPLE_EXERCISES, type SampleId } from './samples'

export type BuiltinUnitId = 'first-steps' | 'traditional-tunes'

export interface BuiltinUnit {
  id: string
  key: BuiltinUnitId
  version: number
  exercises: readonly SampleId[]
}

export const BUILTIN_UNITS: readonly BuiltinUnit[] = [
  {
    id: 'builtin-unit:first-steps',
    key: 'first-steps',
    version: 1,
    exercises: ['open-strings', 'a-string-fingers', 'd-major-scale', 'repeated-notes', 'twinkle'],
  },
  {
    id: 'builtin-unit:traditional-tunes',
    key: 'traditional-tunes',
    version: 1,
    exercises: [
      'lightly-row',
      'song-of-the-wind',
      'go-tell-aunt-rhody',
      'o-come-little-children',
      'may-song',
      'long-long-ago',
    ],
  },
]

const EXERCISE_PREFIX = 'builtin:'

export function builtinExerciseId(id: SampleId): string {
  return EXERCISE_PREFIX + id
}

/** The sample behind a built-in exercise id, or null for any other exercise. */
export function sampleIdOf(exerciseId: string): SampleId | null {
  if (!exerciseId.startsWith(EXERCISE_PREFIX)) return null
  const id = exerciseId.slice(EXERCISE_PREFIX.length)
  return SAMPLE_EXERCISES.find((s) => s.id === id)?.id ?? null
}

/** The built-in unit behind a unit id, or null for any other unit. */
export function unitKeyOf(unitId: string): BuiltinUnitId | null {
  return BUILTIN_UNITS.find((u) => u.id === unitId)?.key ?? null
}
