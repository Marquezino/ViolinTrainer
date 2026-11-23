import { useMemo } from 'react'
import { NOISY_ROOM_HINT_DB } from '../analysis/level'
import type { VoiceProcessing } from '../audio/microphone'
import type { SampleId } from '../exercises/samples'
import { useI18n } from '../i18n/I18nProvider'
import type { EngineSnapshot } from '../practice/engine'
import { startSession, type SessionConfig } from '../practice/wait-session'
import type { Exercise } from '../score/exercise'
import { ScoreView } from './ScoreView'
import { TuningNeedle } from './TuningNeedle'
import { usePractice } from './usePractice'

const MAX_STARS = 3

export function PracticeScreen(props: {
  exercise: Exercise
  sampleId: SampleId | null
  config: SessionConfig
  onExit: () => void
}) {
  const { exercise, sampleId, config, onExit } = props
  const { t } = useI18n()
  const { status, error, snapshot, voiceProcessingOn, start } = usePractice(exercise, config)
  const preview = useMemo(() => startSession(exercise, config, 0), [exercise, config])
  const active = status !== 'idle' && status !== 'error' && snapshot !== null

  return (
    <main className="practice">
      <header className="practice-header">
        <button type="button" onClick={onExit}>
          {t.practice.back}
        </button>
        <h1>{sampleId ? t.sampleTitles[sampleId] : (exercise.title ?? t.untitled)}</h1>
      </header>

      <ScoreView session={active ? snapshot.session : preview} />

      {status === 'idle' && (
        <section className="panel">
          <p>{t.practice.startPrompt}</p>
          <button type="button" className="primary" onClick={() => void start()}>
            {t.practice.start}
          </button>
        </section>
      )}

      {status === 'error' && error && (
        <section className="panel panel-error" role="alert">
          <p>{t.microphoneErrors[error.kind]}</p>
          <button type="button" className="primary" onClick={() => void start()}>
            {t.practice.start}
          </button>
        </section>
      )}

      {active && (
        <PracticeStatus
          snapshot={snapshot}
          config={config}
          preferFlats={exercise.preferFlats}
          voiceProcessingOn={voiceProcessingOn}
          onRestart={() => void start()}
        />
      )}
    </main>
  )
}

function PracticeStatus(props: {
  snapshot: EngineSnapshot
  config: SessionConfig
  preferFlats: boolean
  voiceProcessingOn: VoiceProcessing[]
  onRestart: () => void
}) {
  const { snapshot, config, preferFlats, voiceProcessingOn, onRestart } = props
  const { t, format } = useI18n()
  const f = format(preferFlats)

  switch (snapshot.phase) {
    case 'measuringNoise':
      return (
        <section className="panel">
          <p>{t.practice.roomCheck}</p>
          <progress max={1} value={snapshot.noiseCheckProgress} />
        </section>
      )

    case 'tooNoisy':
      return (
        <section className="panel panel-error" role="alert">
          {snapshot.noiseProblem === 'playing' ? (
            <p>{t.practice.heardPlaying}</p>
          ) : (
            <p>{t.practice.tooNoisy(Math.round(snapshot.noiseFloorDb ?? 0), f)}</p>
          )}
          <button type="button" className="primary" onClick={onRestart}>
            {t.practice.tryAgain}
          </button>
        </section>
      )

    case 'practicing': {
      const rejection = snapshot.lastRejection
      const noisyRoom = (snapshot.noiseFloorDb ?? -Infinity) > NOISY_ROOM_HINT_DB
      return (
        <>
          <TuningNeedle reading={snapshot.needle} tolerances={config.tolerances} preferFlats={preferFlats} />
          {noisyRoom && <p className="hint">{t.practice.noisyRoomHint}</p>}
          {voiceProcessingOn.length > 0 && (
            <p className="hint">{t.practice.audioProcessingHint(voiceProcessingOn.map((v) => t.voiceProcessing[v]))}</p>
          )}
          <p className="feedback" aria-live="polite">
            {rejection?.kind === 'wrongNote' && t.practice.wrongNote(f.note(rejection.playedMidi))}
            {rejection?.kind === 'outOfTune' && t.practice.outOfTune}
          </p>
        </>
      )
    }

    case 'finished': {
      const result = snapshot.result
      if (!result) return null
      return (
        <section className="panel summary">
          <p className="stars" aria-label={t.practice.starsLabel(result.stars, MAX_STARS, f)}>
            {'★'.repeat(result.stars)}
            {'☆'.repeat(MAX_STARS - result.stars)}
          </p>
          <p>{t.practice.summary(result.points, result.maxPoints, f)}</p>
          <button type="button" className="primary" onClick={onRestart}>
            {t.practice.playAgain}
          </button>
        </section>
      )
    }
  }
}
