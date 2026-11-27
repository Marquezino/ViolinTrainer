export const REMIND_AFTER_MS = 14 * 86_400_000
export const SNOOZE_MS = 7 * 86_400_000

/** Remind a parent to export a backup: there is data, the last backup is old, and no recent "later". */
export function shouldShowBackupReminder(s: {
  hasAttempts: boolean
  lastBackupAt: number | null
  dismissedAt: number | null
  now: number
}): boolean {
  if (!s.hasAttempts) return false
  if (s.lastBackupAt !== null && s.now - s.lastBackupAt < REMIND_AFTER_MS) return false
  if (s.dismissedAt !== null && s.now - s.dismissedAt < SNOOZE_MS) return false
  return true
}
