import { clearSavedLocale } from '../i18n/saved-locale'
import type { VtDatabase } from './db'

/**
 * Deletes everything this app saved in the browser: the whole database (players, progress,
 * streaks, notes, settings) and the saved language. Throws, with nothing deleted, when the
 * database cannot be deleted. `db` is closed afterwards: reload the page to start fresh.
 */
export async function deleteAllData(db: VtDatabase): Promise<void> {
  await db.delete()
  clearSavedLocale()
}
