import { describe, expect, test } from 'vitest'
import type { FrameAnalysis } from '../analysis/frame-analyzer'
import { MicrophoneError, type FrameHandler, type Microphone } from '../audio/microphone'
import { DEFAULT_A4_HZ, DEFAULT_TOLERANCES } from '../music/pitch'
import type { EngineSnapshot } from '../practice/engine'
import { DEFAULT_HINT_DELAY_MS, type SessionConfig } from '../practice/wait-session'
import { parseExercise } from '../score/abc'
import { PracticeRunner, type PracticeStatus } from './practice-runner'

const config: SessionConfig = {
  tolerances: DEFAULT_TOLERANCES,
  a4Hz: DEFAULT_A4_HZ,
  hintDelayMs: DEFAULT_HINT_DELAY_MS,
  initialHint: () => true,
}
const parsed = parseExercise('X:1\nL:1/4\nK:D\nA |]')
if (!parsed.ok) throw new Error('bad test exercise')
const exercise = parsed.exercise

/** A microphone whose start can be resolved or rejected by the test. */
function fakeMicrophones() {
  const pending: { resolve: () => void; reject: (e: unknown) => void; onFrame: FrameHandler }[] = []
  const stopped: number[] = []
  let created = 0
  const startMicrophone = (onFrame: FrameHandler) =>
    new Promise<Microphone>((resolve, reject) => {
      const id = created++
      pending.push({
        onFrame,
        reject,
        resolve: () => resolve({ sampleRate: 48000, stop: async () => void stopped.push(id) }),
      })
    })
  return { pending, stopped, startMicrophone }
}

function setup(analysis: FrameAnalysis = { hz: null, clarity: 0, rmsDb: -90 }) {
  const mics = fakeMicrophones()
  const frames = new Map<number, () => void>()
  let nextFrame = 1
  const statuses: PracticeStatus[] = []
  const errors: (MicrophoneError | null)[] = []
  const snapshots: EngineSnapshot[] = []
  const runner = new PracticeRunner(
    {
      startMicrophone: mics.startMicrophone,
      createAnalyzer: () => () => analysis,
      requestFrame: (cb) => {
        frames.set(nextFrame, cb)
        return nextFrame++
      },
      cancelFrame: (id) => void frames.delete(id),
    },
    {
      onStatus: (status, error) => {
        statuses.push(status)
        errors.push(error)
      },
      onSnapshot: (s) => void snapshots.push(s),
    },
  )
  const runFrames = () => {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach((cb) => cb())
  }
  return { runner, mics, frames, statuses, errors, snapshots, runFrames }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('PracticeRunner', () => {
  test('starts the microphone and publishes snapshots once per animation frame', async () => {
    const t = setup()
    const started = t.runner.start(exercise, config)
    await flush()
    t.mics.pending[0].resolve()
    await started
    expect(t.statuses).toEqual(['starting', 'running'])
    expect(t.frames.size).toBe(1)
    t.runFrames()
    expect(t.snapshots.length).toBeGreaterThanOrEqual(2)
    expect(t.frames.size).toBe(1)
  })

  test('stopping while the microphone is still starting releases it as soon as it opens', async () => {
    const t = setup()
    const started = t.runner.start(exercise, config)
    await flush()
    await t.runner.stop()
    t.mics.pending[0].resolve()
    await started
    expect(t.mics.stopped).toEqual([0])
    expect(t.frames.size).toBe(0)
    expect(t.statuses).not.toContain('running')
  })

  test('pressing Start again while starting leaves only the newest microphone open', async () => {
    const t = setup()
    const first = t.runner.start(exercise, config)
    await flush()
    const second = t.runner.start(exercise, config)
    await flush()
    t.mics.pending[0].resolve()
    t.mics.pending[1].resolve()
    await Promise.all([first, second])
    expect(t.mics.stopped).toEqual([0])
    expect(t.frames.size).toBe(1)
  })

  test('stop() releases a running microphone and the frame loop', async () => {
    const t = setup()
    const started = t.runner.start(exercise, config)
    await flush()
    t.mics.pending[0].resolve()
    await started
    await t.runner.stop()
    expect(t.mics.stopped).toEqual([0])
    expect(t.frames.size).toBe(0)
  })

  test('a blocked room ends the loop and releases the microphone', async () => {
    const t = setup({ hz: null, clarity: 0, rmsDb: -20 })
    const started = t.runner.start(exercise, config)
    await flush()
    t.mics.pending[0].resolve()
    await started
    for (let ms = 10; ms <= 2100; ms += 10) t.mics.pending[0].onFrame(new Float32Array(2048), ms, 48000)
    t.runFrames()
    await flush()
    expect(t.snapshots.at(-1)?.phase).toBe('tooNoisy')
    expect(t.mics.stopped).toEqual([0])
    expect(t.frames.size).toBe(0)
  })

  test('a refused microphone reports the error', async () => {
    const t = setup()
    const started = t.runner.start(exercise, config)
    await flush()
    t.mics.pending[0].reject(new MicrophoneError('denied', 'blocked'))
    await started
    expect(t.statuses).toEqual(['starting', 'error'])
    expect(t.errors.at(-1)?.kind).toBe('denied')
  })
})
