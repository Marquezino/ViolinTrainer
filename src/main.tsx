import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './i18n/I18nProvider'
import { syncBuiltinUnits } from './store/builtin'
import { DB_NAME, openDatabase, type VtDatabase } from './store/db'
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

void main()
