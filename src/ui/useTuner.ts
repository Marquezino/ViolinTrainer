import { useCallback, useEffect, useRef, useState } from 'react'
import { createFrameAnalyzer, type FrameAnalyzer } from '../analysis/frame-analyzer'
import { FRAME_SIZE, HOP_SIZE } from '../analysis/frame-collector'
import { isPitched } from '../analysis/level'
import { PitchSmoother } from '../analysis/pitch-smoother'
import { MicrophoneError, startMicrophone, type FrameHandler, type Microphone } from '../audio/microphone'
import { nearestOpenString } from '../practice/tuning'
import type { PracticeStatus } from './practice-runner'

export type TunerReading = { midi: number; cents: number }

export interface TunerDeps {
  startMicrophone: (onFrame: FrameHandler) => Promise<Microphone>
  createAnalyzer: () => FrameAnalyzer
  requestFrame: (callback: () => void) => number
  cancelFrame: (id: number) => void
}

export interface TunerCallbacks {
  onStatus: (status: PracticeStatus, error: MicrophoneError | null) => void
  onReading: (reading: TunerReading | null) => void
}

/**
 * Listens for the tuning screen: the microphone, a 100 ms median of the pitch and the
 * animation-frame loop that publishes it. Nothing is judged or saved. Like PracticeRunner, every
 * start() or stop() begins a new generation, so a microphone that opens after the player left is
 * released instead of used.
 */
export class TunerRunner {
  private readonly deps: TunerDeps
  private readonly callbacks: TunerCallbacks
  private generation = 0
  private mic: Microphone | null = null
  private frameRequest: number | null = null

  constructor(deps: TunerDeps, callbacks: TunerCallbacks) {
    this.deps = deps
    this.callbacks = callbacks
  }

  async start(a4Hz: number): Promise<void> {
    const generation = ++this.generation
    await this.release()
    if (generation !== this.generation) return

    this.callbacks.onReading(null)
    this.callbacks.onStatus('starting', null)
    const analyze = this.deps.createAnalyzer()
    const smoother = new PitchSmoother(100)
    let latest: TunerReading | null = null

    let mic: Microphone
    try {
      mic = await this.deps.startMicrophone((frame, timeMs, sampleRate) => {
        const analysis = analyze(frame, sampleRate)
        const hz = smoother.push(isPitched(analysis) ? analysis.hz : null, timeMs)
        latest = hz === null ? null : nearestOpenString(hz, a4Hz)
      })
    } catch (e) {
      if (generation !== this.generation) return
      this.callbacks.onStatus('error', e instanceof MicrophoneError ? e : new MicrophoneError('other', String(e)))
      return
    }
    if (generation !== this.generation) {
      await mic.stop()
      return
    }

    this.mic = mic
    this.callbacks.onStatus('running', null)
    const publish = () => {
      this.frameRequest = null
      if (generation !== this.generation) return
      this.callbacks.onReading(latest)
      this.frameRequest = this.deps.requestFrame(publish)
    }
    this.frameRequest = this.deps.requestFrame(publish)
  }

  async stop(): Promise<void> {
    this.generation++
    await this.release()
  }

  private async release(): Promise<void> {
    if (this.frameRequest !== null) this.deps.cancelFrame(this.frameRequest)
    this.frameRequest = null
    const mic = this.mic
    this.mic = null
    await mic?.stop()
  }
}

/** The nearest open string and its cents deviation, once per screen refresh. Call start() from a click. */
export function useTuner(a4Hz: number): {
  status: PracticeStatus
  error: MicrophoneError | null
  reading: TunerReading | null
  start(): void
} {
  const [status, setStatus] = useState<PracticeStatus>('idle')
  const [error, setError] = useState<MicrophoneError | null>(null)
  const [reading, setReading] = useState<TunerReading | null>(null)
  const runnerRef = useRef<TunerRunner | null>(null)

  runnerRef.current ??= new TunerRunner(
    {
      startMicrophone,
      createAnalyzer: () => createFrameAnalyzer(FRAME_SIZE, HOP_SIZE),
      requestFrame: (callback) => requestAnimationFrame(callback),
      cancelFrame: (id) => cancelAnimationFrame(id),
    },
    {
      onStatus: (s, e) => {
        setStatus(s)
        setError(e)
      },
      // Skips the re-render when nothing changed, which is most frames while nobody plays.
      onReading: (r) => setReading((old) => (old?.midi === r?.midi && old?.cents === r?.cents ? old : r)),
    },
  )

  const start = useCallback(() => void runnerRef.current?.start(a4Hz), [a4Hz])

  useEffect(() => {
    const runner = runnerRef.current
    return () => void runner?.stop()
  }, [])

  return { status, error, reading, start }
}
