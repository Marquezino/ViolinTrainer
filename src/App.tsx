import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useI18n } from './i18n/I18nProvider'
import { DEFAULT_A4_HZ, DEFAULT_TOLERANCES } from './music/pitch'
import { DEFAULT_HINT_DELAY_MS, type SessionConfig } from './practice/wait-session'
import { hintCounts, initialHintFor } from './progress/hints'
import { parseExercise } from './score/abc'
import type { HintState } from './store/records'
import { useDb, useStorageAvailable } from './ui/DbProvider'
import { LeaderboardScreen } from './ui/LeaderboardScreen'
import { exerciseTitle, PathScreen } from './ui/PathScreen'
import { PracticeScreen } from './ui/PracticeScreen'
import { ProfilePicker } from './ui/ProfilePicker'
import { SettingsScreen } from './ui/SettingsScreen'
import { TryAbcScreen } from './ui/TryAbcScreen'
import { TuningScreen } from './ui/TuningScreen'

type Screen =
  | { name: 'picker' }
  | { name: 'path'; profileId: string }
  | { name: 'tuning'; profileId: string; exerciseId: string }
  | { name: 'practice'; profileId: string; exerciseId: string }
  | { name: 'leaderboard'; from: Screen }
  | { name: 'settings' }
  | { name: 'tryAbc' }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'picker' })
  const { t } = useI18n()
  const storageAvailable = useStorageAvailable()

  return (
    <>
      {!storageAvailable && (
        <p className="storage-banner" role="alert">
          {t.storage.notSaved}
        </p>
      )}
      <CurrentScreen screen={screen} go={setScreen} />
    </>
  )
}

function CurrentScreen({ screen, go }: { screen: Screen; go: (s: Screen) => void }) {
  const { setLocale } = useI18n()
  switch (screen.name) {
    case 'path':
      return (
        <PathRoute
          profileId={screen.profileId}
          onBack={() => go({ name: 'picker' })}
          onLeaderboard={() => go({ name: 'leaderboard', from: screen })}
          onPlay={(exerciseId, skipTuning) =>
            go({ name: skipTuning ? 'practice' : 'tuning', profileId: screen.profileId, exerciseId })
          }
        />
      )
    case 'tuning':
      return (
        <TuningRoute
          profileId={screen.profileId}
          onBack={() => go({ name: 'path', profileId: screen.profileId })}
          onDone={() => go({ name: 'practice', profileId: screen.profileId, exerciseId: screen.exerciseId })}
        />
      )
    case 'practice':
      return (
        <PracticeRoute
          profileId={screen.profileId}
          exerciseId={screen.exerciseId}
          onExit={() => go({ name: 'path', profileId: screen.profileId })}
        />
      )
    case 'settings':
      return <SettingsScreen onBack={() => go({ name: 'picker' })} onTryAbc={() => go({ name: 'tryAbc' })} />
    case 'tryAbc':
      return <TryAbcRoute onBack={() => go({ name: 'settings' })} />
    case 'leaderboard':
      return <LeaderboardScreen onBack={() => go(screen.from)} />
    case 'picker':
      return (
        <ProfilePicker
          onChoose={(profile) => {
            // The picker keeps showing the last player's language (§9).
            setLocale(profile.locale)
            go({ name: 'path', profileId: profile.id })
          }}
          onSettings={() => go({ name: 'settings' })}
          onLeaderboard={() => go({ name: 'leaderboard', from: screen })}
        />
      )
  }
}

/** The path, with the profile's "skip tuning" choice attached to every play. */
function PathRoute(props: {
  profileId: string
  onBack: () => void
  onLeaderboard: () => void
  onPlay: (exerciseId: string, skipTuning: boolean) => void
}) {
  const { profileId, onPlay, ...rest } = props
  const db = useDb()
  const skipTuning = useLiveQuery(async () => (await db.profiles.get(profileId))?.skipTuning ?? false, [db, profileId])
  return <PathScreen profileId={profileId} {...rest} onPlay={(exerciseId) => onPlay(exerciseId, skipTuning ?? false)} />
}

/** The tuning helper with the profile's choice and the A4 setting. */
function TuningRoute(props: { profileId: string; onBack: () => void; onDone: () => void }) {
  const { profileId, onBack, onDone } = props
  const db = useDb()
  const data = useLiveQuery(async () => {
    const [profile, settings] = await Promise.all([db.profiles.get(profileId), db.settings.get('app')])
    return { profile, a4Hz: settings?.a4Hz ?? DEFAULT_A4_HZ }
  }, [db, profileId])
  if (!data?.profile) return null
  return (
    <TuningScreen
      profileId={profileId}
      a4Hz={data.a4Hz}
      skipTuning={data.profile.skipTuning}
      onBack={onBack}
      onDone={onDone}
    />
  )
}

function sessionConfig(
  tolerances: SessionConfig['tolerances'],
  a4Hz: number,
  hintStates: readonly HintState[] | null,
): SessionConfig {
  return {
    tolerances,
    a4Hz,
    hintDelayMs: DEFAULT_HINT_DELAY_MS,
    // Without a profile (Try ABC) every hint shows from the start.
    initialHint: hintStates ? initialHintFor(hintCounts(hintStates)) : () => true,
  }
}

/** Loads a stored exercise and the profile's settings, then practises it with saving on. */
function PracticeRoute(props: { profileId: string; exerciseId: string; onExit: () => void }) {
  const { profileId, exerciseId, onExit } = props
  const { t } = useI18n()
  const db = useDb()
  const data = useLiveQuery(async () => {
    const [profile, settings, record, hintStates] = await Promise.all([
      db.profiles.get(profileId),
      db.settings.get('app'),
      db.exercises.get(exerciseId),
      db.hintStates.where('profileId').equals(profileId).toArray(),
    ])
    return { profile, a4Hz: settings?.a4Hz ?? DEFAULT_A4_HZ, record, hintStates }
  }, [db, profileId, exerciseId])

  const abc = data?.record?.abc
  const parsed = useMemo(() => (abc === undefined ? null : parseExercise(abc)), [abc])
  const greenCents = data?.profile?.greenCents
  const yellowCents = data?.profile?.yellowCents
  const a4Hz = data?.a4Hz
  const hintStates = data?.hintStates
  const config = useMemo(
    () =>
      greenCents === undefined || yellowCents === undefined || a4Hz === undefined || hintStates === undefined
        ? null
        : sessionConfig({ greenCents, yellowCents }, a4Hz, hintStates),
    [greenCents, yellowCents, a4Hz, hintStates],
  )

  if (!data || !data.record || !parsed || !config) return null
  if (!parsed.ok) {
    return (
      <main className="practice">
        <header className="practice-header">
          <button type="button" onClick={onExit}>
            {t.practice.backToPath}
          </button>
        </header>
        <p className="panel panel-error">{t.path.brokenExercise}</p>
      </main>
    )
  }
  return (
    <PracticeScreen
      exercise={parsed.exercise}
      title={exerciseTitle(t, data.record)}
      config={config}
      progress={{ profileId, exerciseId }}
      onExit={onExit}
    />
  )
}

function TryAbcRoute({ onBack }: { onBack: () => void }) {
  const db = useDb()
  const a4Hz = useLiveQuery(async () => (await db.settings.get('app'))?.a4Hz ?? DEFAULT_A4_HZ, [db])
  const config = useMemo(() => sessionConfig(DEFAULT_TOLERANCES, a4Hz ?? DEFAULT_A4_HZ, null), [a4Hz])
  if (a4Hz === undefined) return null
  return <TryAbcScreen config={config} onBack={onBack} />
}
