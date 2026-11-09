import { expect, test } from 'vitest'
import { parseExercise } from '../score/abc'
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
