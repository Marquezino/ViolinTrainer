import { expect, test } from 'vitest'
import { parseExercise } from '../score/abc'
import { BUILTIN_UNITS, builtinExerciseId, sampleIdOf, unitKeyOf } from './builtin-units'
import { SAMPLE_EXERCISES } from './samples'

test.each(SAMPLE_EXERCISES)('$id parses without errors or warnings, all in first position', ({ abc }) => {
  const result = parseExercise(abc)
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.warnings).toEqual([])
    expect(result.exercise.targets.every((t) => t.fingering !== null)).toBe(true)
  }
})

test('ids are unique', () => {
  const ids = SAMPLE_EXERCISES.map((s) => s.id)
  expect(new Set(ids).size).toBe(ids.length)
})

test('every unit lists existing samples, and every sample is in exactly one unit', () => {
  const listed = BUILTIN_UNITS.flatMap((u) => u.exercises)
  expect([...listed].sort()).toEqual(SAMPLE_EXERCISES.map((s) => s.id).sort())
})

test('built-in ids map back to their sample and unit', () => {
  expect(sampleIdOf(builtinExerciseId('may-song'))).toBe('may-song')
  expect(sampleIdOf('builtin:nope')).toBeNull()
  expect(sampleIdOf(crypto.randomUUID())).toBeNull()
  expect(unitKeyOf('builtin-unit:traditional-tunes')).toBe('traditional-tunes')
  expect(unitKeyOf(crypto.randomUUID())).toBeNull()
})
