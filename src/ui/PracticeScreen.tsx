import { useMemo } from 'react'
import type { MicrophoneError } from '../audio/microphone'
import type { EngineSnapshot } from '../practice/engine'
import { startSession, type SessionConfig } from '../practice/wait-session'
import type { Exercise } from '../score/exercise'
import { ScoreView } from './ScoreView'
import { TuningNeedle } from './TuningNeedle'
import { usePractice } from './usePractice'

const MIC_ERROR_TEXT: Record<MicrophoneError['kind'], string> = {
  denied:
    'Microphone access is blocked. Click the microphone icon in the address bar, allow access, then press Start again.',
  notFound: 'No microphone was found. Connect one and press Start again.',
  unsupported: 'This browser cannot analyze microphone audio. Use a current version of Chrome or Firefox.',
  other: 'The microphone could not be started.',
}

export function PracticeScreen(props: { exercise: Exercise; config: SessionConfig; onExit: () => void }) {
  const { exercise, config, onExit } = props
  const { status, error, snapshot, start } = usePractice(exercise, config)
  const preview = useMemo(() => startSession(exercise, config, 0), [exercise, config])
  const active = status !== 'idle' && status !== 'error' && snapshot !== null

  return (
    <main className="practice">
      <header className="practice-header">
        <button type="button" onClick={onExit}>
          ← Exercises
        </button>
        <h1>{exercise.title}</h1>
      </header>

      <ScoreView session={active ? snapshot.session : preview} />

      {status === 'idle' && (
        <section className="panel">
          <p>When you press Start, stay quiet for two seconds while the app listens to the room.</p>
          <button type="button" className="primary" onClick={() => void start()}>
            Start
          </button>
        </section>
      )}

      {status === 'error' && error && (
        <section className="panel panel-error" role="alert">
          <p>{MIC_ERROR_TEXT[error.kind]}</p>
          <button type="button" className="primary" onClick={() => void start()}>
            Start
          </button>
        </section>
      )}

      {active && <PracticeStatus snapshot={snapshot} config={config} onRestart={() => void start()} />}
    </main>
  )
}

function PracticeStatus(props: { snapshot: EngineSnapshot; config: SessionConfig; onRestart: () => void }) {
  const { snapshot, config, onRestart } = props

  switch (snapshot.phase) {
    case 'measuringNoise':
      return (
        <section className="panel">
          <p>Stay quiet… checking the room.</p>
          <progress max={1} value={snapshot.noiseCheckProgress} />
        </section>
      )

    case 'tooNoisy':
      return (
        <section className="panel panel-error" role="alert">
          {snapshot.noiseProblem === 'playing' ? (
            <p>I heard playing during the room check. Stay quiet until the check is over, then start playing.</p>
          ) : (
            <p>
              The room is too noisy for reliable judging ({Math.round(snapshot.noiseFloorDb ?? 0)} dB). Close
              windows or move away from the noise, then try again.
            </p>
          )}
          <button type="button" className="primary" onClick={onRestart}>
            Try again
          </button>
        </section>
      )

    case 'practicing': {
      const rejection = snapshot.lastRejection
      return (
        <>
          <TuningNeedle reading={snapshot.needle} tolerances={config.tolerances} />
          <p className="feedback" aria-live="polite">
            {rejection?.kind === 'wrongNote' && `That was ${rejection.playedName}. Try again.`}
            {rejection?.kind === 'outOfTune' && 'Right note, but out of tune. Adjust and play it again.'}
          </p>
        </>
      )
    }

    case 'finished': {
      const result = snapshot.result
      if (!result) return null
      return (
        <section className="panel summary">
          <p className="stars" aria-label={`${result.stars} of 3 stars`}>
            {'★'.repeat(result.stars)}
            {'☆'.repeat(3 - result.stars)}
          </p>
          <p>
            {result.points} of {result.maxPoints} points. Yellow notes were a little out of tune; notes with a red
            ring needed more than one try.
          </p>
          <button type="button" className="primary" onClick={onRestart}>
            Play again
          </button>
        </section>
      )
    }
  }
}
