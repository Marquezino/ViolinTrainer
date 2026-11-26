import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { sampleIdOf, unitKeyOf } from '../exercises/builtin-units'
import { useI18n } from '../i18n/I18nProvider'
import { isLocale, LOCALE_LABELS, LOCALES } from '../i18n/locales'
import type { Formatters, Messages } from '../i18n/messages'
import type { Stars } from '../practice/scoring'
import { localDay } from '../progress/days'
import { activeMsByDay, goalMinutesOn } from '../progress/history'
import { weeklyLeaderboard } from '../progress/leaderboard'
import { notesBalance, repairOffers, type RepairOffer } from '../progress/notes'
import { streaks } from '../progress/streaks'
import { bestStars, bestStarsSum, nextToPlay, unlockedExercises } from '../progress/unlocking'
import { loadHistory, loadPath } from '../store/history'
import { updateProfile } from '../store/profiles'
import type { ExerciseRecord, Unit } from '../store/records'
import { repairStreak } from '../store/repairs'
import { useDb } from './DbProvider'
import { STREAK_SYMBOLS, StreakBadges } from './StreakBadges'

const MAX_STARS = 3

/** Title of a stored exercise: translated for built-ins, as stored otherwise. */
export function exerciseTitle(t: Messages, exercise: Pick<ExerciseRecord, 'id' | 'title'>): string {
  const sampleId = sampleIdOf(exercise.id)
  return sampleId ? t.sampleTitles[sampleId] : exercise.title || t.untitled
}

function unitTitle(t: Messages, unit: Unit): string {
  const key = unitKeyOf(unit.id)
  return key ? t.unitTitles[key] : unit.title || t.untitled
}

export function PathScreen(props: { profileId: string; onBack: () => void; onLeaderboard: () => void; onPlay: (exerciseId: string) => void }) {
  const { profileId, onBack, onLeaderboard, onPlay } = props
  const { locale, t, setLocale, format } = useI18n()
  const f = format(false)
  const db = useDb()
  const data = useLiveQuery(async () => {
    const [profile, history, path, manual] = await Promise.all([
      db.profiles.get(profileId),
      loadHistory(db, profileId),
      loadPath(db),
      db.manualUnlocks.where('profileId').equals(profileId).toArray(),
    ])
    return { profile, history, ...path, manualUnlocks: manual.map((m) => m.exerciseId) }
  }, [db, profileId])

  const nextRef = useRef<HTMLLIElement>(null)
  const scrolled = useRef(false)
  useEffect(() => {
    if (!data || scrolled.current) return
    scrolled.current = true
    nextRef.current?.scrollIntoView({ block: 'center' })
  }, [data])

  if (!data) return null
  const { profile, history, units, exercises, path } = data
  if (!profile) return null

  const today = localDay(Date.now())
  const best = bestStars(history.attempts)
  const unlocked = unlockedExercises(path, history.attempts, data.manualUnlocks)
  const next = nextToPlay(path, unlocked, best)
  const todayMs = activeMsByDay(history.attempts).get(today) ?? 0
  const goalMinutes = goalMinutesOn(history.goals, today)
  const { easy, practice } = streaks(history, today)
  const week = weeklyLeaderboard([{ profileId, history }], today)[0].week
  const starsSum = bestStarsSum(best)
  const notes = notesBalance(history, starsSum)
  const offers = repairOffers(history, starsSum, today)

  return (
    <main className="path">
      <header className="screen-header">
        <button type="button" onClick={onBack}>
          {t.path.back}
        </button>
        <h1>{profile.name}</h1>
        <button type="button" onClick={onLeaderboard}>
          {t.leaderboard.open}
        </button>
        <select
          aria-label={t.languageLabel}
          value={locale}
          onChange={(e) => {
            const chosen = e.target.value
            if (!isLocale(chosen)) return
            setLocale(chosen)
            void updateProfile(db, profileId, { locale: chosen }, Date.now())
          }}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_LABELS[l]}
            </option>
          ))}
        </select>
      </header>

      <section className="today panel">
        <GoalRing activeMs={todayMs} goalMinutes={goalMinutes} />
        <div className="today-details">
          <p className="goal-time">{t.path.todayTime(todayMs, goalMinutes, f)}</p>
          <StreakBadges easy={easy} practice={practice} />
          <p className="week-dots" role="img" aria-label={t.path.weekLabel(week.filter(Boolean).length, f)}>
            {week.map((goalDay) => (goalDay ? '●' : '○')).join('')}
          </p>
          <p className="notes-balance" role="img" aria-label={t.notes.balanceLabel(notes, f)}>
            ♪ {f.number(notes)}
          </p>
        </div>
      </section>

      {offers.map((offer) => (
        <RepairOfferCard key={offer.streak} offer={offer} profileId={profileId} f={f} />
      ))}

      {exercises.length === 0 && <p className="panel">{t.path.empty}</p>}
      {units.map((unit) => {
        const items = exercises.filter((e) => e.unitId === unit.id)
        if (items.length === 0) return null
        return (
          <section key={unit.id} className="unit">
            <h2>{unitTitle(t, unit)}</h2>
            <ul className="path-list">
              {items.map((exercise) => {
                const open = unlocked.has(exercise.id)
                const isNext = exercise.id === next
                const stars = best.get(exercise.id) ?? 0
                return (
                  <li key={exercise.id} ref={isNext ? nextRef : undefined}>
                    <button
                      type="button"
                      className={`path-item${isNext ? ' path-next' : ''}`}
                      disabled={!open}
                      onClick={() => onPlay(exercise.id)}
                    >
                      <span className="path-title">{exerciseTitle(t, exercise)}</span>
                      {isNext && <span className="path-badge">{t.path.next}</span>}
                      {open ? (
                        <StarRating stars={stars} label={t.practice.starsLabel(stars, MAX_STARS, f)} />
                      ) : (
                        <span className="path-lock" role="img" aria-label={t.path.locked}>
                          🔒
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </main>
  )
}

function StarRating({ stars, label }: { stars: Stars; label: string }) {
  return (
    <span className="path-stars" role="img" aria-label={label}>
      {'★'.repeat(stars)}
      {'☆'.repeat(MAX_STARS - stars)}
    </span>
  )
}

const RING_RADIUS = 40
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

function GoalRing({ activeMs, goalMinutes }: { activeMs: number; goalMinutes: number }) {
  const { t, format } = useI18n()
  const done = Math.min(1, activeMs / (goalMinutes * 60_000))
  return (
    <svg
      className={`goal-ring${done >= 1 ? ' goal-ring-done' : ''}`}
      viewBox="0 0 100 100"
      role="img"
      aria-label={t.path.goalRingLabel(activeMs, goalMinutes, format(false))}
    >
      <circle className="goal-ring-track" cx="50" cy="50" r={RING_RADIUS} />
      <circle
        className="goal-ring-fill"
        cx="50"
        cy="50"
        r={RING_RADIUS}
        strokeDasharray={`${done * RING_LENGTH} ${RING_LENGTH}`}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="58" textAnchor="middle" className="goal-ring-text">
        {done >= 1 ? '✓' : `${Math.floor(done * 100)}%`}
      </text>
    </svg>
  )
}

function RepairOfferCard({ offer, profileId, f }: { offer: RepairOffer; profileId: string; f: Formatters }) {
  const { t } = useI18n()
  const db = useDb()
  const [confirming, setConfirming] = useState(false)
  const [problem, setProblem] = useState<keyof Messages['notes']['errors'] | null>(null)
  const pay = async () => {
    setConfirming(false)
    try {
      await repairStreak(db, profileId, offer.streak, Date.now())
    } catch (e) {
      const message = e instanceof Error ? e.message : ''
      setProblem(message === 'noOffer' || message === 'notAffordable' ? message : 'other')
    }
  }
  return (
    <section className="panel repair-offer">
      <p>{t.notes.broke(offer.streak)}</p>
      {confirming ? (
        <div className="confirm">
          <p>{t.notes.confirm(offer.cost, f)}</p>
          <button type="button" className="primary" onClick={() => void pay()}>
            {t.notes.confirmYes}
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            {t.notes.cancel}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="primary"
          disabled={!offer.affordable}
          onClick={() => {
            setProblem(null)
            setConfirming(true)
          }}
        >
          {t.notes.repairOffer(offer.restores, STREAK_SYMBOLS[offer.streak], offer.cost, f)}
        </button>
      )}
      {!offer.affordable && <p className="hint">{t.notes.missing(offer.missing, f)}</p>}
      {problem && (
        <p className="errors" role="alert">
          {t.notes.errors[problem]}
        </p>
      )}
    </section>
  )
}
