import { useLiveQuery } from 'dexie-react-hooks'
import { useI18n } from '../i18n/I18nProvider'
import { localDay } from '../progress/days'
import { weeklyLeaderboard } from '../progress/leaderboard'
import { streaks } from '../progress/streaks'
import { loadHistory } from '../store/history'
import { listProfiles } from '../store/profiles'
import { AvatarIcon } from './Avatar'
import { useDb } from './DbProvider'
import { StreakBadges } from './StreakBadges'

/** The weekly family board. It ranks effort (goal days), so it never shows stars or accuracy. */
export function LeaderboardScreen({ onBack }: { onBack: () => void }) {
  const { t, format } = useI18n()
  const f = format(false)
  const db = useDb()
  const rows = useLiveQuery(async () => {
    const today = localDay(Date.now())
    const profiles = await listProfiles(db)
    const entries = await Promise.all(
      profiles.map(async (profile) => ({ profile, profileId: profile.id, history: await loadHistory(db, profile.id) })),
    )
    return weeklyLeaderboard(entries, today).map((row) => {
      const entry = entries.find((e) => e.profileId === row.profileId)!
      return { ...row, profile: entry.profile, ...streaks(entry.history, today) }
    })
  }, [db])

  return (
    <main className="leaderboard">
      <header className="screen-header">
        <button type="button" onClick={onBack}>
          {t.leaderboard.back}
        </button>
        <h1>{t.leaderboard.heading}</h1>
      </header>
      <p className="leaderboard-subtitle">{t.leaderboard.subtitle}</p>
      {rows && rows.length === 0 && <p className="panel">{t.leaderboard.empty}</p>}
      {rows && rows.length > 0 && (
        <ol className="leaderboard-rows">
          {rows.map((row) => (
            <li key={row.profileId} className="leaderboard-row panel">
              <span className="leaderboard-place" role="img" aria-label={t.leaderboard.placeLabel(row.place, f)}>
                {f.number(row.place)}
              </span>
              <AvatarIcon avatar={row.profile.avatar} />
              <span className="profile-name">{row.profile.name}</span>
              <span className="week-dots" role="img" aria-label={t.path.weekLabel(row.goalDays, f)}>
                {row.week.map((goalDay) => (goalDay ? '●' : '○')).join('')}
              </span>
              <span className="leaderboard-counts">
                {t.leaderboard.goalDays(row.goalDays, f)} · {t.leaderboard.runs(row.completedRuns, f)}
              </span>
              <StreakBadges easy={row.easy} practice={row.practice} />
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}
