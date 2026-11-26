import { backupFileName, exportBackup } from '../store/backup'
import type { VtDatabase } from '../store/db'

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

/** Exports every table to a JSON file and records the backup time. */
export async function downloadBackup(db: VtDatabase): Promise<void> {
  const now = Date.now()
  downloadJson(backupFileName(now), await exportBackup(db, now))
}
