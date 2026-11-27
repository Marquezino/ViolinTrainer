import { expect, test } from 'vitest'
import type { FrameAnalysis } from '../analysis/frame-analyzer'
import { MicrophoneError, type FrameHandler, type Microphone } from '../audio/microphone'
import type { PracticeStatus } from './practice-runner'
import { TunerRunner, type TunerReading } from './useTuner'

function setup() {
  const pending: { resolve: () => void; reject: (e: unknown) => void; onFrame: FrameHandler }[] = []
  const stopped: number[] = []
  let analysis: FrameAnalysis = { hz: null, clarity: 0, rmsDb: -90 }
  const frames = new Map<number, () => void>()
  let nextFrame = 1
  const statuses: PracticeStatus[] = []
  const errors: (MicrophoneError | null)[] = []
  const readings: (TunerReading | null)[] = []
  const runner = new TunerRunner(
    {
      startMicrophone: (onFrame) =>
        new Promise<Microphone>((resolve, reject) => {
          const id = pending.length
          pending.push({
            onFrame,
            reject,
            resolve: () => resolve({ sampleRate: 48000, voiceProcessingOn: [], stop: async () => void stopped.push(id) }),
          })
        }),
      createAnalyzer: () => () => analysis,
      requestFrame: (cb) => {
        frames.set(nextFrame, cb)
        return nextFrame++
      },
      cancelFrame: (id) => void frames.delete(id),
    },
    {
      onStatus: (s, e) => {
        statuses.push(s)
        errors.push(e)
      },
      onReading: (r) => readings.push(r),
    },
  )
  const runFrames = () => {
    const due = [...frames.values()]
    frames.clear()
    due.forEach((cb) => cb())
  }
  const hear = (a: FrameAnalysis, timeMs: number) => {
    analysis = a
    pending.at(-1)!.onFrame(new Float32Array(4), timeMs, 48000)
  }
  return { runner, pending, stopped, frames, statuses, errors, readings, runFrames, hear }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

test('publishes the nearest open string of pitched frames, and nothing for unpitched ones', async () => {
  const s = setup()
  const started = s.runner.start(442)
  await flush()
  s.pending[0].resolve()
  await started
  expect(s.statuses).toEqual(['starting', 'running'])

  s.hear({ hz: 442, clarity: 0.95, rmsDb: -20 }, 10)
  s.runFrames()
  expect(s.readings.at(-1)?.midi).toBe(69)
  expect(s.readings.at(-1)?.cents).toBeCloseTo(0, 6)

  // A quiet but unclear frame does not count.
  s.hear({ hz: 300, clarity: 0.5, rmsDb: -20 }, 20)
  s.runFrames()
  expect(s.readings.at(-1)).toBeNull()

  await s.runner.stop()
  expect(s.stopped).toEqual([0])
  expect(s.frames.size).toBe(0)
})

test('a microphone that opens after stop() is released, not used', async () => {
  const s = setup()
  const started = s.runner.start(440)
  await flush()
  await s.runner.stop()
  s.pending[0].resolve()
  await started
  expect(s.stopped).toEqual([0])
  expect(s.statuses).toEqual(['starting'])
  expect(s.frames.size).toBe(0)
})

test('a refused microphone reports the error, unless the player already left', async () => {
  const s = setup()
  const first = s.runner.start(440)
  await flush()
  s.pending[0].reject(new MicrophoneError('denied', 'no'))
  await first
  expect(s.statuses.at(-1)).toBe('error')
  expect(s.errors.at(-1)?.kind).toBe('denied')

  const second = s.runner.start(440)
  await flush()
  await s.runner.stop()
  s.pending[1].reject(new Error('late'))
  await second
  expect(s.statuses.at(-1)).toBe('starting')
})
