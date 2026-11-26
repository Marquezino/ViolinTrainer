import 'fake-indexeddb/auto'
import { expect, test } from 'vitest'
import { openDatabase, TABLE_NAMES } from './db'

test('opens with the app-specific name and schema version 1', async () => {
  const db = openDatabase()
  expect(db.name).toBe('violin-trainer')
  await db.open()
  expect(db.verno).toBe(1)
  db.close()
})

test('TABLE_NAMES lists every table', async () => {
  const db = openDatabase(`test-${crypto.randomUUID()}`)
  expect([...TABLE_NAMES].sort()).toEqual(db.tables.map((t) => t.name).sort())
  db.close()
})
