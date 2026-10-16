import { useCallback, useEffect, useRef, useState } from 'react'
import { createFrameAnalyzer } from '../analysis/frame-analyzer'
import { FRAME_SIZE, HOP_SIZE } from '../analysis/frame-collector'
import { MicrophoneError, startMicrophone, type Microphone } from '../audio/microphone'
import { PracticeEngine, type EngineSnapshot } from '../practice/engine'
import { startSession, type SessionConfig } from '../practice/wait-session'
import type { Exercise } from '../score/exercise'

export type PracticeStatus = 'idle' | 'starting' | 'running' | 'error'

/** Connects the microphone to a PracticeEngine and publishes its snapshot once per screen refresh. */
export function usePractice(exercise: Exercise, config: SessionConfig) {
  const [status, setStatus] = useState<PracticeStatus>('idle')
  const [error, setError] = useState<MicrophoneError | null>(null)
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null)
  const micRef = useRef<Microphone | null>(null)
  const frameRequestRef = useRef<number | null>(null)

  const stop = useCallback(async () => {
    if (frameRequestRef.current !== null) cancelAnimationFrame(frameRequestRef.current)
    frameRequestRef.current = null
    const mic = micRef.current
    micRef.current = null
    await mic?.stop()
  }, [])

  const start = useCallback(async () => {
    await stop()
    const engine = new PracticeEngine(startSession(exercise, config, 0))
    setSnapshot(engine.snapshot())
    setError(null)
    setStatus('starting')
    try {
      const analyze = createFrameAnalyzer(FRAME_SIZE, HOP_SIZE)
      micRef.current = await startMicrophone((frame, timeMs, sampleRate) => {
        engine.handleFrame({ ...analyze(frame, sampleRate), timeMs })
      })
    } catch (e) {
      setError(e instanceof MicrophoneError ? e : new MicrophoneError('other', String(e)))
      setStatus('error')
      return
    }
    setStatus('running')
    const publish = () => {
      const s = engine.snapshot()
      setSnapshot(s)
      if (s.phase === 'finished' || s.phase === 'tooNoisy') {
        void stop()
        return
      }
      frameRequestRef.current = requestAnimationFrame(publish)
    }
    frameRequestRef.current = requestAnimationFrame(publish)
  }, [exercise, config, stop])

  useEffect(() => () => void stop(), [stop])

  return { status, error, snapshot, start }
}
