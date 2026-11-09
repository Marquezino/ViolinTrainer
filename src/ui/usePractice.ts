import { useCallback, useEffect, useRef, useState } from 'react'
import { createFrameAnalyzer } from '../analysis/frame-analyzer'
import { FRAME_SIZE, HOP_SIZE } from '../analysis/frame-collector'
import { startMicrophone, type MicrophoneError } from '../audio/microphone'
import type { EngineSnapshot } from '../practice/engine'
import type { SessionConfig } from '../practice/wait-session'
import type { Exercise } from '../score/exercise'
import { PracticeRunner, type PracticeStatus } from './practice-runner'

export type { PracticeStatus } from './practice-runner'

/** Connects the microphone to a PracticeEngine and publishes its snapshot once per screen refresh. */
export function usePractice(exercise: Exercise, config: SessionConfig) {
  const [status, setStatus] = useState<PracticeStatus>('idle')
  const [error, setError] = useState<MicrophoneError | null>(null)
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null)
  const runnerRef = useRef<PracticeRunner | null>(null)

  runnerRef.current ??= new PracticeRunner(
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
      onSnapshot: setSnapshot,
    },
  )

  const start = useCallback(() => runnerRef.current?.start(exercise, config), [exercise, config])

  useEffect(() => {
    const runner = runnerRef.current
    return () => void runner?.stop()
  }, [])

  return { status, error, snapshot, start }
}
