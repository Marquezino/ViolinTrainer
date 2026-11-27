import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './i18n/I18nProvider'
import { detectLocale } from './i18n/locales'
import { MESSAGES } from './i18n/messages'
import { loadSavedLocale } from './i18n/saved-locale'
import { syncBuiltinUnits } from './store/builtin'
import { closeOnVersionChange, DB_NAME, openDatabase, type VtDatabase } from './store/db'
import { requestPersistentStorage } from './store/persistence'
import { getSettings } from './store/profiles'
import { DbProvider } from './ui/DbProvider'

/** The browser's database, or an in-memory one when IndexedDB is unavailable (some private windows). */
async function startDatabase(): Promise<{ db: VtDatabase; storageAvailable: boolean }> {
  const db = openDatabase()
  try {
    await db.open()
    return { db, storageAvailable: true }
  } catch (e) {
    console.warn('IndexedDB is unavailable; progress will not be saved', e)
    const { indexedDB, IDBKeyRange } = await import('fake-indexeddb')
    const memory = openDatabase(DB_NAME, { indexedDB, IDBKeyRange })
    await memory.open()
    return { db: memory, storageAvailable: false }
  }
}

async function main(): Promise<void> {
  const { db, storageAvailable } = await startDatabase()
  // Data deleted (or upgraded) in another tab: start again from it rather than show stale screens.
  closeOnVersionChange(db, () => location.reload())
  await syncBuiltinUnits(db, Date.now())
  // Creates the settings row, so screens can read it inside live queries (which cannot write).
  await getSettings(db)
  void requestPersistentStorage()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nProvider>
        <DbProvider db={db} storageAvailable={storageAvailable}>
          <App />
        </DbProvider>
      </I18nProvider>
    </StrictMode>,
  )
}

const STARTUP_FAILED_FALLBACK = 'Violin Trainer could not start. Please reload the page.'

/** A plain line instead of a blank page, in the saved or browser language when possible. */
function showStartupError(e: unknown): void {
  console.error('Starting the app failed', e)
  let text = STARTUP_FAILED_FALLBACK
  try {
    text = MESSAGES[detectLocale(loadSavedLocale(), navigator.languages ?? [])].startupFailed
  } catch {
    // Keep the English line.
  }
  const root = document.getElementById('root') ?? document.body
  const line = document.createElement('p')
  line.setAttribute('role', 'alert')
  line.textContent = text
  root.replaceChildren(line)
}

main().catch(showStartupError)
