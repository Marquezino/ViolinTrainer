import type { FrameAnalyzer } from '../analysis/frame-analyzer'
import { MicrophoneError, type FrameHandler, type Microphone } from '../audio/microphone'
import { PracticeEngine, type EngineSnapshot } from '../practice/engine'
import { startSession, type SessionConfig } from '../practice/wait-session'
import type { Exercise } from '../score/exercise'

export type PracticeStatus = 'idle' | 'starting' | 'running' | 'error'

export interface RunnerDeps {
  startMicrophone: (onFrame: FrameHandler) => Promise<Microphone>
  createAnalyzer: () => FrameAnalyzer
  requestFrame: (callback: () => void) => number
  cancelFrame: (id: number) => void
}

export interface RunnerCallbacks {
  onStatus: (status: PracticeStatus, error: MicrophoneError | null) => void
  onSnapshot: (snapshot: EngineSnapshot) => void
}

/**
 * Owns one practice run at a time: the microphone, the engine and the animation-frame loop.
 * Every start() or stop() begins a new generation; work from an older generation that finishes
 * late (a microphone that opens after the player left) is released instead of used.
 */
export class PracticeRunner {
  private readonly deps: RunnerDeps
  private readonly callbacks: RunnerCallbacks
  private generation = 0
  private mic: Microphone | null = null
  private frameRequest: number | null = null

  constructor(deps: RunnerDeps, callbacks: RunnerCallbacks) {
    this.deps = deps
    this.callbacks = callbacks
  }

  async start(exercise: Exercise, config: SessionConfig): Promise<void> {
    const generation = ++this.generation
    await this.release()
    if (generation !== this.generation) return

    const engine = new PracticeEngine(startSession(exercise, config, 0))
    this.callbacks.onSnapshot(engine.snapshot())
    this.callbacks.onStatus('starting', null)
    const analyze = this.deps.createAnalyzer()

    let mic: Microphone
    try {
      mic = await this.deps.startMicrophone((frame, timeMs, sampleRate) => {
        engine.handleFrame({ ...analyze(frame, sampleRate), timeMs })
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
      const snapshot = engine.snapshot()
      this.callbacks.onSnapshot(snapshot)
      if (snapshot.phase === 'finished' || snapshot.phase === 'tooNoisy') {
        void this.release()
        return
      }
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
