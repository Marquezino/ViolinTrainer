import { clearSavedLocale } from '../i18n/saved-locale'
import type { VtDatabase } from './db'

/** After this long without finishing, a delete is reported as blocked. */
export const DELETE_BLOCKED_AFTER_MS = 5_000

export interface DeleteOptions {
  /**
   * Called once when the delete has to wait: another tab still holds the database open, or it
   * takes longer than `blockedAfterMs`. The delete keeps waiting (IndexedDB cannot cancel it) and
   * finishes as soon as the other connections close.
   */
  onBlocked?: () => void
  blockedAfterMs?: number
}

/**
 * Deletes everything this app saved in the browser: the whole database (players, progress,
 * streaks, notes, settings) and the saved language. When the delete fails it throws, the saved
 * language stays and `db` opens again on its next query, so the app keeps working. After a
 * successful delete, reload the page to start fresh.
 */
export async function deleteAllData(db: VtDatabase, options: DeleteOptions = {}): Promise<void> {
  const { onBlocked, blockedAfterMs = DELETE_BLOCKED_AFTER_MS } = options
  let reported = false
  const report = () => {
    if (reported) return
    reported = true
    onBlocked?.()
  }
  const timer = setTimeout(report, blockedAfterMs)
  db.on('blocked', report)
  try {
    // Without disableAutoOpen: false, a failed delete would leave `db` closed for good.
    await db.delete({ disableAutoOpen: false })
  } finally {
    clearTimeout(timer)
    db.on('blocked').unsubscribe(report)
  }
  clearSavedLocale()
}
