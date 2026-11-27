import { expect, test } from 'vitest'
import type { Exercise, Target } from '../score/exercise'
import { noteKey, type Fingering } from '../music/fingering'
import type { HintState, TargetResult } from '../store/records'
import { LEARNED_AFTER, hintCounts, initialHintFor, updateHintCounts } from './hints'

const A4: Fingering = { string: 'A', finger: 0, mark: null }
const B4: Fingering = { string: 'A', finger: 1, mark: null }

function target(index: number, midi: number, fingering: Fingering | null): Target {
  return { index, midi, durationWhole: 0.25, fingering, sourceStarts: [index] }
}

function exercise(...targets: Target[]): Exercise {
  return { title: null, abc: '', targets, preferFlats: false }
}

function result(
  targetId: number,
  color: TargetResult['color'],
  redAttempts = 0,
): TargetResult {
  return { targetId, color, redAttempts, centsAtAcceptance: 0 }
}

const a = target(0, 69, A4)
const keyA = noteKey(69, A4)

function run(counts: Map<string, number>, times: number): Map<string, number> {
  let c = counts
  for (let i = 0; i < times; i++) c = updateHintCounts(exercise(a), [result(0, 'green')], c)
  return c
}

test('five first-try greens in a row hide the hint', () => {
  const four = run(new Map(), LEARNED_AFTER - 1)
  expect(four.get(keyA)).toBe(4)
  expect(initialHintFor(four)(a)).toBe(true)
  const five = run(four, 1)
  expect(five.get(keyA)).toBe(5)
  expect(initialHintFor(five)(a)).toBe(false)
})

test('a red attempt resets the key and a yellow neither counts nor resets', () => {
  const ex = exercise(a)
  const start = new Map([[keyA, 3]])
  expect(updateHintCounts(ex, [result(0, 'yellow')], start).get(keyA)).toBe(3)
  expect(updateHintCounts(ex, [result(0, 'green', 1)], start).get(keyA)).toBe(0)
  expect(updateHintCounts(ex, [result(0, 'yellow', 2)], start).get(keyA)).toBe(0)
  expect(updateHintCounts(ex, [], start).get(keyA)).toBe(3)
  expect(start.get(keyA)).toBe(3)
})

test('the same note twice in one run counts twice, in order', () => {
  const ex = exercise(a, target(1, 69, A4))
  const counts = updateHintCounts(ex, [result(0, 'green'), result(1, 'green', 1)], new Map())
  expect(counts.get(keyA)).toBe(0)
  const two = updateHintCounts(ex, [result(0, 'green'), result(1, 'green')], new Map())
  expect(two.get(keyA)).toBe(2)
})

test('targets outside first position are ignored', () => {
  const ex = exercise(target(0, 90, null))
  const counts = updateHintCounts(ex, [result(0, 'green')], new Map())
  expect(counts.size).toBe(0)
  expect(initialHintFor(counts)(ex.targets[0]!)).toBe(true)
})

test('hintCounts reads stored states', () => {
  const states: HintState[] = [
    { profileId: 'p', noteKey: keyA, consecutiveFirstTryGreens: 5, updatedAt: 0 },
    { profileId: 'p', noteKey: noteKey(71, B4), consecutiveFirstTryGreens: 2, updatedAt: 0 },
  ]
  const counts = hintCounts(states)
  expect(counts.get(keyA)).toBe(5)
  expect(counts.size).toBe(2)
})
