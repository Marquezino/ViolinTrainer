import { expect, test } from 'vitest'
import { FrameCollector } from './frame-collector'

function ramp(from: number, length: number): Float32Array {
  return Float32Array.from({ length }, (_, i) => from + i)
}

test('emits the first frame once it is full, then every hop', () => {
  const frames: { first: number; last: number; end: number }[] = []
  const c = new FrameCollector(8, 4, (f, end) => frames.push({ first: f[0], last: f[7], end }))
  c.push(ramp(0, 7))
  expect(frames).toEqual([])
  c.push(ramp(7, 1))
  expect(frames).toEqual([{ first: 0, last: 7, end: 8 }])
  c.push(ramp(8, 8))
  expect(frames).toEqual([
    { first: 0, last: 7, end: 8 },
    { first: 4, last: 11, end: 12 },
    { first: 8, last: 15, end: 16 },
  ])
})

test('block size does not change the frames (128-sample worklet blocks vs one big block)', () => {
  const signal = ramp(0, 5000)
  const a: number[][] = []
  const b: number[][] = []
  const big = new FrameCollector(2048, 512, (f) => a.push([f[0], f[2047]]))
  big.push(signal)
  const small = new FrameCollector(2048, 512, (f) => b.push([f[0], f[2047]]))
  for (let i = 0; i < signal.length; i += 128) small.push(signal.subarray(i, i + 128))
  expect(b).toEqual(a)
  expect(a.length).toBe(6) // ends at 2048, 2560, 3072, 3584, 4096, 4608
})

test('each frame is a separate copy', () => {
  const frames: Float32Array[] = []
  const c = new FrameCollector(4, 2, (f) => frames.push(f))
  c.push(ramp(0, 6))
  expect(Array.from(frames[0])).toEqual([0, 1, 2, 3])
  expect(Array.from(frames[1])).toEqual([2, 3, 4, 5])
})
