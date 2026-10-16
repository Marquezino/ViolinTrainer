import { expect, test } from 'vitest'
import { HighPassFilter } from './highpass'
import { SAMPLE_RATE, tone } from '../test-support/synth'

function rms(x: Float32Array, from = 0): number {
  let s = 0
  for (let i = from; i < x.length; i++) s += x[i] * x[i]
  return Math.sqrt(s / (x.length - from))
}

function gainDb(hz: number): number {
  const input = tone({ hz, ms: 1000, attackMs: 0, releaseMs: 0 })
  const output = new HighPassFilter(150, SAMPLE_RATE).process(input)
  const settle = SAMPLE_RATE / 4 // skip the filter's start-up transient
  return 20 * Math.log10(rms(output, settle) / rms(input, settle))
}

test('removes traffic rumble', () => {
  expect(gainDb(50)).toBeLessThan(-18)
})

test('keeps the lowest violin note', () => {
  expect(gainDb(196)).toBeGreaterThan(-1.5)
})

test('passes higher notes unchanged', () => {
  expect(Math.abs(gainDb(880))).toBeLessThan(0.2)
})

test('keeps state across blocks', () => {
  const input = tone({ hz: 196, ms: 100 })
  const whole = new HighPassFilter(150, SAMPLE_RATE).process(input)
  const filter = new HighPassFilter(150, SAMPLE_RATE)
  const a = filter.process(input.subarray(0, 1000))
  const b = filter.process(input.subarray(1000))
  expect(Array.from(a).concat(Array.from(b))).toEqual(Array.from(whole))
})
