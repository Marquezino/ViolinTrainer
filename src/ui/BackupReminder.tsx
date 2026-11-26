import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { shouldShowBackupReminder } from '../progress/backup-reminder'
import { DEFAULT_SETTINGS, updateSettings } from '../store/profiles'
import { useDb } from './DbProvider'
import { downloadBackup } from './download-backup'

const DAY_MS = 86_400_000

/** A strip above the profile cards that asks a parent to export a backup. */
export function BackupReminder() {
  const { t, format } = useI18n()
  const db = useDb()
  const [failed, setFailed] = useState(false)
  const state = useLiveQuery(async () => {
    // A plain read: getSettings writes a missing row, which a live query must not do.
    const settings = (await db.settings.get('app')) ?? DEFAULT_SETTINGS
    const hasAttempts = (await db.attempts.count()) > 0
    return { settings, hasAttempts }
  }, [db])
  if (!state) return null
  const now = Date.now()
  const { lastBackupAt, backupReminderDismissedAt } = state.settings
  if (!shouldShowBackupReminder({ hasAttempts: state.hasAttempts, lastBackupAt, dismissedAt: backupReminderDismissedAt, now })) {
    return null
  }
  return (
    <section className="backup-reminder" aria-label={t.backup.reminderLabel}>
      <p>
        {lastBackupAt === null
          ? t.backup.lastBackupNever
          : t.backup.lastBackupDaysAgo(Math.floor((now - lastBackupAt) / DAY_MS), format(false))}
      </p>
      <button
        type="button"
        className="primary"
        onClick={() => {
          setFailed(false)
          downloadBackup(db).catch((e: unknown) => {
            console.error('Exporting the backup failed', e)
            setFailed(true)
          })
        }}
      >
        {t.backup.export}
      </button>
      <button type="button" onClick={() => void updateSettings(db, { backupReminderDismissedAt: Date.now() })}>
        {t.backup.reminderDismiss}
      </button>
      {failed && (
        <p className="errors" role="alert">
          {t.backup.failed}
        </p>
      )}
    </section>
  )
}
