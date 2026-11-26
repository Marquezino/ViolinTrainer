import 'fake-indexeddb/auto'
import { beforeEach, expect, test } from 'vitest'
import { openDatabase, SCHEMA_VERSION, TABLE_NAMES, type VtDatabase } from './db'
import { backupFileName, BACKUP_FORMAT, exportBackup, markBackedUp, parseBackup, replaceWithBackup } from './backup'
import { createProfile, deleteProfile, getSettings, updateSettings } from './profiles'

let db: VtDatabase
beforeEach(() => {
  db = openDatabase(`test-${crypto.randomUUID()}`)
})

const NOW = new Date(2026, 10, 26, 15).getTime()
const input = { name: 'Player A', avatar: 'violin', locale: 'en' } as const

function emptyTables(): Record<string, unknown[]> {
  return Object.fromEntries(TABLE_NAMES.map((t) => [t, []]))
}
function file(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: NOW,
    tables: emptyTables(),
    ...over,
  })
}

test('round trip: export then import into an empty database gives identical tables', async () => {
  await createProfile(db, input, NOW)
  const backup = await exportBackup(db, NOW)
  const parsed = parseBackup(JSON.stringify(backup))
  if (!parsed.ok) throw new Error('should parse')
  expect(parsed.profiles).toBe(1)
  const other = openDatabase(`test-${crypto.randomUUID()}`)
  await replaceWithBackup(other, parsed.backup)
  for (const t of TABLE_NAMES) {
    expect(await other.table(t).toArray()).toEqual(backup.tables[t])
    if (t !== 'settings') expect(await other.table(t).toArray()).toEqual(await db.table(t).toArray())
  }
})

test('soft-deleted rows are included', async () => {
  const p = await createProfile(db, input, NOW)
  await deleteProfile(db, p.id, NOW)
  const backup = await exportBackup(db, NOW)
  expect(backup.tables.profiles).toHaveLength(1)
  const parsed = parseBackup(JSON.stringify(backup))
  expect(parsed.ok && parsed.profiles).toBe(0)
})

test('the exported settings carry lastBackupAt = now, but exporting alone stores nothing', async () => {
  const before = await exportBackup(db, NOW)
  expect(before.tables.settings).toEqual([expect.objectContaining({ id: 'app', lastBackupAt: NOW })])
  expect((await getSettings(db)).lastBackupAt).toBeNull()

  await updateSettings(db, { lastBackupAt: NOW - 1000, a4Hz: 442 })
  const backup = await exportBackup(db, NOW)
  expect(backup.tables.settings).toEqual([expect.objectContaining({ lastBackupAt: NOW, a4Hz: 442 })])
  expect((await getSettings(db)).lastBackupAt).toBe(NOW - 1000)
})

test('markBackedUp records the backup time', async () => {
  await markBackedUp(db, NOW)
  expect((await getSettings(db)).lastBackupAt).toBe(NOW)
})

test('backupFileName uses the local day', () => {
  expect(backupFileName(NOW)).toBe('violin-trainer-backup-2026-11-26.json')
})

const missing = emptyTables()
delete missing.attempts
test.each([
  ['not json', '{', 'notJson'],
  ['other app', '{"format":"x"}', 'notABackup'],
  ['missing table', file({ tables: missing }), 'notABackup'],
  ['a table that is not an array', file({ tables: { ...emptyTables(), units: {} } }), 'notABackup'],
  ['newer version', file({ schemaVersion: SCHEMA_VERSION + 1 }), 'newerVersion'],
])('parseBackup refuses %s', (_n, text, problem) => {
  expect(parseBackup(text)).toEqual({ ok: false, problem })
})

test('a failing import leaves the current data untouched', async () => {
  await createProfile(db, input, NOW)
  const before = await db.profiles.toArray()
  const dup = { id: 'a', profileId: 'p', exerciseId: 'e' }
  const parsed = parseBackup(file({ tables: { ...emptyTables(), attempts: [dup, dup] } }))
  if (!parsed.ok) throw new Error('should parse')
  await expect(replaceWithBackup(db, parsed.backup)).rejects.toThrow()
  expect(await db.profiles.toArray()).toEqual(before)
  expect(await db.attempts.count()).toBe(0)
})
