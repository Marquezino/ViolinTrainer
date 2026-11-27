import { localDay } from '../progress/days'
import { SCHEMA_VERSION, TABLE_NAMES, type TableName, type VtDatabase } from './db'
import { DEFAULT_SETTINGS, updateSettings } from './profiles'
import type { Settings } from './records'

export const BACKUP_FORMAT = 'violin-trainer-backup'

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  schemaVersion: number
  exportedAt: number
  tables: Record<TableName, unknown[]>
}

// Every table, soft-deleted rows included. Writes nothing: the exported
// settings row carries lastBackupAt = now, and the stored one is set by
// markBackedUp only once the file was actually saved.
export async function exportBackup(db: VtDatabase, now: number): Promise<BackupFile> {
  const tables = {} as Record<TableName, unknown[]>
  await db.transaction(
    'r',
    TABLE_NAMES.map((t) => db.table(t)),
    async () => {
      for (const name of TABLE_NAMES) tables[name] = await db.table(name).toArray()
    },
  )
  const settings = (tables.settings as Settings[]).find((s) => s.id === 'app')
  tables.settings = [
    ...(tables.settings as Settings[]).filter((s) => s.id !== 'app'),
    { ...(settings ?? { id: 'app', ...DEFAULT_SETTINGS }), lastBackupAt: now },
  ]
  return { format: BACKUP_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: now, tables }
}

/** Records that a backup file was saved at `now`. */
export async function markBackedUp(db: VtDatabase, now: number): Promise<void> {
  await updateSettings(db, { lastBackupAt: now })
}

export function backupFileName(now: number): string {
  return `${BACKUP_FORMAT}-${localDay(now)}.json`
}

export type BackupProblem = 'notJson' | 'notABackup' | 'newerVersion'

export type ParsedBackup =
  | { ok: true; backup: BackupFile; profiles: number; attempts: number }
  | { ok: false; problem: BackupProblem }

// Checks the envelope and that every table is an array; rows are not validated.
export function parseBackup(text: string): ParsedBackup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, problem: 'notJson' }
  }
  const file = data as Partial<BackupFile> | null
  if (typeof file !== 'object' || file === null || file.format !== BACKUP_FORMAT) {
    return { ok: false, problem: 'notABackup' }
  }
  const tables = file.tables as Record<string, unknown> | undefined
  if (typeof tables !== 'object' || tables === null) return { ok: false, problem: 'notABackup' }
  if (!TABLE_NAMES.every((t) => Array.isArray(tables[t]))) {
    return { ok: false, problem: 'notABackup' }
  }
  if (typeof file.schemaVersion !== 'number') return { ok: false, problem: 'notABackup' }
  if (file.schemaVersion > SCHEMA_VERSION) return { ok: false, problem: 'newerVersion' }
  const backup = file as BackupFile
  const profiles = (backup.tables.profiles as { deletedAt?: number | null }[]).filter(
    (p) => p?.deletedAt == null,
  ).length
  return { ok: true, backup, profiles, attempts: backup.tables.attempts.length }
}

// One transaction: any error (e.g. a duplicate id) rolls everything back.
export async function replaceWithBackup(db: VtDatabase, backup: BackupFile): Promise<void> {
  await db.transaction(
    'rw',
    TABLE_NAMES.map((t) => db.table(t)),
    async () => {
      for (const name of TABLE_NAMES) {
        const table = db.table(name)
        await table.clear()
        await table.bulkAdd(backup.tables[name])
      }
    },
  )
}
