import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useI18n } from '../i18n/I18nProvider'
import { validateTolerances, type ToleranceProblem } from '../music/pitch'
import { localDay } from '../progress/days'
import { goalMinutesOn } from '../progress/history'
import {
  backupFileName,
  exportBackup,
  parseBackup,
  replaceWithBackup,
  type BackupFile,
  type BackupProblem,
} from '../store/backup'
import type { VtDatabase } from '../store/db'
import { persistenceStatus, type PersistenceStatus } from '../store/persistence'
import {
  createProfile,
  deleteProfile,
  GOAL_MAX,
  GOAL_MIN,
  GOAL_STEP,
  listProfiles,
  setGoal,
  updateProfile,
  updateSettings,
} from '../store/profiles'
import type { Avatar, Profile } from '../store/records'
import { AVATAR_SYMBOLS, AVATARS } from './Avatar'
import { useDb } from './DbProvider'

export const A4_MIN = 415
export const A4_MAX = 466

const GOAL_CHOICES: number[] = []
for (let m = GOAL_MIN; m <= GOAL_MAX; m += GOAL_STEP) GOAL_CHOICES.push(m)

/** Saves a file through an object URL and a temporary link. */
function downloadJson(name: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  // Revoked later: some browsers start reading the URL only after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

async function downloadBackup(db: VtDatabase): Promise<void> {
  const now = Date.now()
  downloadJson(backupFileName(now), await exportBackup(db, now))
}

export function SettingsScreen(props: { onBack: () => void; onTryAbc: () => void }) {
  const { onBack, onTryAbc } = props
  const { t } = useI18n()
  const db = useDb()
  const data = useLiveQuery(async () => {
    const [profiles, goals, settings] = await Promise.all([
      listProfiles(db),
      db.goalSettings.toArray(),
      db.settings.get('app'),
    ])
    return { profiles, goals, settings }
  }, [db])
  if (!data) return null
  const today = localDay(Date.now())

  return (
    <main className="settings">
      <header className="screen-header">
        <button type="button" onClick={onBack}>
          {t.settings.back}
        </button>
        <h1>{t.settings.heading}</h1>
      </header>

      <section>
        <h2>{t.settings.playersHeading}</h2>
        {data.profiles.map((profile) => (
          <ProfileForm
            key={profile.id}
            profile={profile}
            goalMinutes={goalMinutesOn(
              data.goals.filter((g) => g.profileId === profile.id),
              today,
            )}
          />
        ))}
        <AddProfileForm used={data.profiles.map((p) => p.avatar)} />
      </section>

      {data.settings && <A4Form a4Hz={data.settings.a4Hz} />}

      <BackupSection />

      <section>
        <h2>{t.settings.otherHeading}</h2>
        <PersistenceLine />
        <button type="button" onClick={onTryAbc}>
          {t.settings.tryAbc}
        </button>
      </section>
    </main>
  )
}

function AvatarSelect(props: { value: Avatar; onChange: (a: Avatar) => void }) {
  const { t } = useI18n()
  return (
    <label>
      {t.settings.avatar}
      <select value={props.value} onChange={(e) => props.onChange(e.target.value as Avatar)}>
        {AVATARS.map((a) => (
          <option key={a} value={a}>
            {AVATAR_SYMBOLS[a]} {t.profiles.avatars[a]}
          </option>
        ))}
      </select>
    </label>
  )
}

function AddProfileForm({ used }: { used: Avatar[] }) {
  const { t, locale } = useI18n()
  const db = useDb()
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<Avatar | null>(null)
  const [problem, setProblem] = useState(false)
  // Until one is chosen, suggest the first picture nobody has yet.
  const shown = avatar ?? AVATARS.find((a) => !used.includes(a)) ?? AVATARS[0]

  return (
    <form
      className="add-profile"
      onSubmit={(e) => {
        e.preventDefault()
        const trimmed = name.trim()
        if (!trimmed) {
          setProblem(true)
          return
        }
        setProblem(false)
        // Cleared now, not after the save: a name typed meanwhile must not be wiped.
        setName('')
        setAvatar(null)
        void createProfile(db, { name: trimmed, avatar: shown, locale }, Date.now())
      }}
    >
      <label>
        {t.settings.newPlayerName}
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      </label>
      <AvatarSelect value={shown} onChange={setAvatar} />
      <button type="submit" className="primary">
        {t.settings.addPlayer}
      </button>
      {problem && (
        <p className="errors" role="alert">
          {t.settings.nameRequired}
        </p>
      )}
    </form>
  )
}

type ProfileProblem = { kind: 'tolerance'; problem: ToleranceProblem } | { kind: 'name' }

function ProfileForm({ profile, goalMinutes }: { profile: Profile; goalMinutes: number }) {
  const { t } = useI18n()
  const db = useDb()
  const [name, setName] = useState(profile.name)
  const [avatar, setAvatar] = useState(profile.avatar)
  const [goal, setGoalValue] = useState(goalMinutes)
  const [green, setGreen] = useState(String(profile.greenCents))
  const [yellow, setYellow] = useState(String(profile.yellowCents))
  const [skipTuning, setSkipTuning] = useState(profile.skipTuning)
  const [problem, setProblem] = useState<ProfileProblem | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const legendId = `profile-${profile.id}`

  const save = async () => {
    setSaved(false)
    const trimmed = name.trim()
    if (!trimmed) {
      setProblem({ kind: 'name' })
      return
    }
    const tolerances = { greenCents: Number(green), yellowCents: Number(yellow) }
    // An empty yellow box is NaN, which validateTolerances would let through.
    const toleranceProblem = Number.isFinite(tolerances.yellowCents)
      ? validateTolerances(tolerances)
      : 'yellowBelowGreen'
    if (toleranceProblem) {
      setProblem({ kind: 'tolerance', problem: toleranceProblem })
      return
    }
    setProblem(null)
    const now = Date.now()
    await updateProfile(db, profile.id, { name: trimmed, avatar, ...tolerances, skipTuning }, now)
    if (goal !== goalMinutes) await setGoal(db, profile.id, goal, localDay(now), now)
    setSaved(true)
  }

  return (
    <fieldset className="profile-form" aria-labelledby={legendId}>
      <legend id={legendId}>{profile.name}</legend>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        onChange={() => setSaved(false)}
      >
        <label>
          {t.settings.name}
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </label>
        <AvatarSelect value={avatar} onChange={setAvatar} />
        <label>
          {t.settings.goal}
          <select value={goal} onChange={(e) => setGoalValue(Number(e.target.value))}>
            {GOAL_CHOICES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.settings.greenCents}
          <input type="number" min={1} max={49} step={1} value={green} onChange={(e) => setGreen(e.target.value)} />
        </label>
        <label>
          {t.settings.yellowCents}
          <input type="number" min={1} max={49} step={1} value={yellow} onChange={(e) => setYellow(e.target.value)} />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={skipTuning} onChange={(e) => setSkipTuning(e.target.checked)} />
          {t.settings.skipTuning}
        </label>
        <div className="actions">
          <button type="submit" className="primary">
            {t.settings.save}
          </button>
          {saved && <span className="saved">{t.settings.saved}</span>}
        </div>
        {problem && (
          <p className="errors" role="alert">
            {problem.kind === 'name' ? t.settings.nameRequired : t.toleranceProblems[problem.problem]}
          </p>
        )}
      </form>
      {confirmingDelete ? (
        <div className="confirm">
          <p>{t.settings.deleteConfirm(profile.name)}</p>
          <button type="button" className="danger" onClick={() => void deleteProfile(db, profile.id, Date.now())}>
            {t.settings.deleteYes}
          </button>
          <button type="button" onClick={() => setConfirmingDelete(false)}>
            {t.settings.cancel}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmingDelete(true)}>
          {t.settings.deletePlayer}
        </button>
      )}
    </fieldset>
  )
}

function A4Form({ a4Hz }: { a4Hz: number }) {
  const { t, format } = useI18n()
  const db = useDb()
  const [value, setValue] = useState(String(a4Hz))
  const [problem, setProblem] = useState(false)
  const [saved, setSaved] = useState(false)
  return (
    <section>
      <h2>{t.settings.a4Heading}</h2>
      <form
        className="a4-form"
        onSubmit={(e) => {
          e.preventDefault()
          const hz = Number(value)
          const ok = Number.isFinite(hz) && hz >= A4_MIN && hz <= A4_MAX
          setProblem(!ok)
          setSaved(false)
          if (ok) void updateSettings(db, { a4Hz: hz }).then(() => setSaved(true))
        }}
      >
        <label>
          {t.settings.a4Label}
          <input
            type="number"
            min={A4_MIN}
            max={A4_MAX}
            step={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setSaved(false)
            }}
          />
        </label>
        <button type="submit" className="primary">
          {t.settings.save}
        </button>
        {saved && <span className="saved">{t.settings.saved}</span>}
        {problem && (
          <p className="errors" role="alert">
            {t.settings.a4Problem(A4_MIN, A4_MAX, format(false))}
          </p>
        )}
      </form>
    </section>
  )
}

type ImportState =
  | { step: 'idle' }
  | { step: 'problem'; problem: BackupProblem }
  | { step: 'confirm'; backup: BackupFile; profiles: number; attempts: number }
  | { step: 'restored' }
  | { step: 'failed' }

function BackupSection() {
  const { t, format } = useI18n()
  const db = useDb()
  const [state, setState] = useState<ImportState>({ step: 'idle' })
  const f = format(false)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const parsed = parseBackup(await file.text())
    setState(parsed.ok ? { step: 'confirm', ...parsed } : { step: 'problem', problem: parsed.problem })
  }

  const replace = async (backup: BackupFile) => {
    try {
      // A copy of the current data first, in case the wrong file was chosen.
      await downloadBackup(db)
      await replaceWithBackup(db, backup)
      setState({ step: 'restored' })
    } catch (e) {
      console.error('Restoring the backup failed', e)
      setState({ step: 'failed' })
    }
  }

  return (
    <section>
      <h2>{t.backup.heading}</h2>
      <p>
        <button type="button" onClick={() => void downloadBackup(db)}>
          {t.backup.export}
        </button>
      </p>
      <label className="file-input">
        {t.backup.import}
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            void onFile(e.target.files?.[0])
            // Choosing the same file again still fires a change.
            e.target.value = ''
          }}
        />
      </label>
      {state.step === 'problem' && (
        <p className="errors" role="alert">
          {t.backup.problems[state.problem]}
        </p>
      )}
      {state.step === 'confirm' && (
        <div className="confirm">
          <p>{t.backup.confirm(state.profiles, state.attempts, f)}</p>
          <button type="button" className="danger" onClick={() => void replace(state.backup)}>
            {t.backup.replace}
          </button>
          <button type="button" onClick={() => setState({ step: 'idle' })}>
            {t.backup.cancel}
          </button>
        </div>
      )}
      {state.step === 'restored' && <p role="status">{t.backup.restored}</p>}
      {state.step === 'failed' && (
        <p className="errors" role="alert">
          {t.backup.failed}
        </p>
      )}
    </section>
  )
}

function PersistenceLine() {
  const { t } = useI18n()
  const [status, setStatus] = useState<PersistenceStatus | null>(null)
  useEffect(() => {
    let live = true
    void persistenceStatus().then((s) => live && setStatus(s))
    return () => {
      live = false
    }
  }, [])
  return status && <p className="hint">{t.storage.persistence[status]}</p>
}
