import { useCallback, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { NOISY_ROOM_HINT_DB } from '../analysis/level'
import type { VoiceProcessing } from '../audio/microphone'
import { useI18n } from '../i18n/I18nProvider'
import type { EngineSnapshot } from '../practice/engine'
import { startSession, type SessionConfig } from '../practice/wait-session'
import { celebrationsFor, goalJustReached, type ProgressSummary } from '../progress/celebrations'
import { localDay } from '../progress/days'
import { activeMsByDay, goalMinutesOn, type ProfileHistory } from '../progress/history'
import { streaks } from '../progress/streaks'
import { bestStars } from '../progress/unlocking'
import type { Exercise } from '../score/exercise'
import { loadHistory } from '../store/history'
import { attemptFrom } from '../store/runs'
import { Celebration } from './Celebration'
import { useDb } from './DbProvider'
import { ScoreView } from './ScoreView'
import { StreakBadges } from './StreakBadges'
import { TuningNeedle } from './TuningNeedle'
import { usePractice } from './usePractice'
import { useRunRecorder } from './useRunRecorder'

const MAX_STARS = 3

/** Who is playing what: set when the run is saved for a profile. "Try ABC" leaves it out and saves nothing. */
export interface PracticeProgress {
  profileId: string
  exerciseId: string
}

export function PracticeScreen(props: {
  exercise: Exercise
  title: string
  config: SessionConfig
  progress?: PracticeProgress
  onExit: () => void
}) {
  const { exercise, title, config, progress, onExit } = props
  const { t } = useI18n()
  const { status, error, snapshot, voiceProcessingOn, start } = usePractice(exercise, config)
  const preview = useMemo(() => startSession(exercise, config, 0), [exercise, config])
  const active = status !== 'idle' && status !== 'error' && snapshot !== null
  // Wall-clock time of the last Start: attempts from before it are "before this run".
  const [runStartedAt, setRunStartedAt] = useState(() => Date.now())
  const begin = useCallback(() => {
    setRunStartedAt(Date.now())
    void start()
  }, [start])

  return (
    <main className="practice">
      {progress && <RunRecorder progress={progress} exercise={exercise} snapshot={snapshot} />}
      <header className="practice-header">
        <button type="button" onClick={onExit}>
          {progress ? t.practice.backToPath : t.practice.back}
        </button>
        <h1>{title}</h1>
      </header>

      <ScoreView session={active ? snapshot.session : preview} />

      {status === 'idle' && (
        <section className="panel">
          <p>{t.practice.startPrompt}</p>
          <button type="button" className="primary" onClick={begin}>
            {t.practice.start}
          </button>
        </section>
      )}

      {status === 'error' && error && (
        <section className="panel panel-error" role="alert">
          <p>{t.microphoneErrors[error.kind]}</p>
          <button type="button" className="primary" onClick={begin}>
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
          onRestart={begin}
          onExit={progress ? onExit : null}
        />
      )}

      {active && progress && (
        <RunProgress progress={progress} snapshot={snapshot} runStartedAt={runStartedAt} />
      )}
    </main>
  )
}

/** A component, so that "Try ABC" can leave the recorder out entirely. */
function RunRecorder(props: { progress: PracticeProgress; exercise: Exercise; snapshot: EngineSnapshot | null }) {
  const db = useDb()
  const { profileId, exerciseId } = props.progress
  useRunRecorder({ db, profileId, exerciseId, exercise: props.exercise, snapshot: props.snapshot })
  return null
}

function summaryOf(h: ProfileHistory, exerciseId: string, today: string, goalMs: number): ProgressSummary {
  return {
    todayActiveMs: activeMsByDay(h.attempts).get(today) ?? 0,
    goalMs,
    ...streaks(h, today),
    bestStars: bestStars(h.attempts).get(exerciseId) ?? 0,
  }
}

/**
 * The goal banner during a run, and the progress lines and celebrations of the summary. "Before"
 * is the stored history without this run (attempts started before `runStartedAt`), "after" adds
 * this run as the recorder saves it. Both are computed rather than waiting for the save, which
 * lands asynchronously.
 */
function RunProgress(props: { progress: PracticeProgress; snapshot: EngineSnapshot; runStartedAt: number }) {
  const { progress, snapshot, runStartedAt } = props
  const { t, format } = useI18n()
  const f = format(false)
  const db = useDb()
  const history = useLiveQuery(() => loadHistory(db, progress.profileId), [db, progress.profileId])
  const [dismissedRun, setDismissedRun] = useState<number | null>(null)
  const dismiss = useCallback(() => setDismissedRun(runStartedAt), [runStartedAt])
  if (!history) return null

  // A run belongs to the local day it started.
  const today = localDay(runStartedAt)
  const goalMinutes = goalMinutesOn(history.goals, today)
  const goalMs = goalMinutes * 60_000
  const before: ProfileHistory = { ...history, attempts: history.attempts.filter((a) => a.startedAt < runStartedAt) }
  const beforeSummary = summaryOf(before, progress.exerciseId, today, goalMs)

  if (snapshot.phase === 'practicing') {
    if (!goalJustReached(beforeSummary.todayActiveMs, snapshot.activeMs, goalMs)) return null
    return (
      <p className="goal-banner" role="status">
        {t.practice.goalReached}
      </p>
    )
  }
  if (snapshot.phase !== 'finished') return null

  const thisRun = attemptFrom({
    id: 'this-run',
    ...progress,
    startedAt: runStartedAt,
    snapshot,
    finishedAt: runStartedAt,
  })
  const after: ProfileHistory = { ...before, attempts: [...before.attempts, thisRun] }
  const afterSummary = summaryOf(after, progress.exerciseId, today, goalMs)
  const celebrations = celebrationsFor(beforeSummary, afterSummary)

  return (
    <section className="panel run-progress">
      <p>{t.practice.today(afterSummary.todayActiveMs, goalMinutes, f)}</p>
      <StreakBadges easy={afterSummary.easy} practice={afterSummary.practice} />
      {dismissedRun !== runStartedAt && <Celebration items={celebrations} onDone={dismiss} />}
    </section>
  )
}

function PracticeStatus(props: {
  snapshot: EngineSnapshot
  config: SessionConfig
  preferFlats: boolean
  voiceProcessingOn: VoiceProcessing[]
  onRestart: () => void
  /** Set when the summary offers "Back to path". */
  onExit: (() => void) | null
}) {
  const { snapshot, config, preferFlats, voiceProcessingOn, onRestart, onExit } = props
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
          <div className="actions">
            <button type="button" className="primary" onClick={onRestart}>
              {t.practice.playAgain}
            </button>
            {onExit && (
              <button type="button" onClick={onExit}>
                {t.practice.backToPathButton}
              </button>
            )}
          </div>
        </section>
      )
    }
  }
}
