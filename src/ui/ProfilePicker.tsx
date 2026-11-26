import { useLiveQuery } from 'dexie-react-hooks'
import { useI18n } from '../i18n/I18nProvider'
import { localDay } from '../progress/days'
import { streaks } from '../progress/streaks'
import { loadHistory } from '../store/history'
import { listProfiles } from '../store/profiles'
import type { Profile } from '../store/records'
import { AvatarIcon } from './Avatar'
import { useDb } from './DbProvider'
import { StreakBadges } from './StreakBadges'

export function ProfilePicker(props: { onChoose: (profile: Profile) => void; onSettings: () => void; onLeaderboard: () => void }) {
  const { onChoose, onSettings, onLeaderboard } = props
  const { t } = useI18n()
  const db = useDb()
  const cards = useLiveQuery(async () => {
    const today = localDay(Date.now())
    const profiles = await listProfiles(db)
    return Promise.all(
      profiles.map(async (profile) => ({ profile, ...streaks(await loadHistory(db, profile.id), today) })),
    )
  }, [db])

  return (
    <main className="picker">
      <header className="screen-header">
        <h1>{t.profiles.heading}</h1>
        <button type="button" onClick={onLeaderboard}>
          {t.leaderboard.open}
        </button>
        <button type="button" onClick={onSettings}>
          {t.profiles.settings}
        </button>
      </header>
      {/* Task 14 puts the backup reminder here, above the cards. */}
      {cards && cards.length === 0 && (
        <p className="picker-empty">
          <button type="button" className="primary big" onClick={onSettings}>
            {t.profiles.addFirst}
          </button>
        </p>
      )}
      {cards && cards.length > 0 && (
        <ul className="profile-cards">
          {cards.map(({ profile, easy, practice }) => (
            <li key={profile.id}>
              <button type="button" className="profile-card" onClick={() => onChoose(profile)}>
                <AvatarIcon avatar={profile.avatar} />
                <span className="profile-name">{profile.name}</span>
                <StreakBadges easy={easy} practice={practice} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
