import { expect, test } from 'vitest'
import { ActiveTimer } from './active-time'

function timer(start: number, ...notes: number[]): ActiveTimer {
  const t = new ActiveTimer(start)
  for (const n of notes) t.noteAt(n)
  return t
}

test('counts time up to the last note', () => {
  expect(timer(0, 1000, 5000).activeMs).toBe(5000)
})

test('drops gaps of 30 s or more', () => {
  expect(timer(0, 1000, 31000, 32000).activeMs).toBe(2000)
})

test('a gap just under 30 s counts', () => {
  expect(timer(0, 29999).activeMs).toBe(29999)
})

test('no notes means zero', () => {
  expect(timer(0).activeMs).toBe(0)
})
