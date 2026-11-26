import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LOCALE_STORAGE_KEY } from '../i18n/saved-locale'
import { openDatabase } from './db'
import { createProfile, listProfiles } from './profiles'
import { deleteAllData } from './reset'

const NOW = new Date(2026, 5, 10, 15).getTime()
const input = { name: 'Player A', avatar: 'violin', locale: 'pt-BR' } as const

let saved: Map<string, string>
beforeEach(() => {
  saved = new Map([[LOCALE_STORAGE_KEY, 'pt-BR']])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => saved.get(k) ?? null,
    setItem: (k: string, v: string) => void saved.set(k, v),
    removeItem: (k: string) => void saved.delete(k),
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('deleteAllData removes the database and the saved language', async () => {
  const name = `test-${crypto.randomUUID()}`
  const db = openDatabase(name)
  await createProfile(db, input, NOW)
  await deleteAllData(db)
  expect(saved.has(LOCALE_STORAGE_KEY)).toBe(false)
  const fresh = openDatabase(name)
  expect(await listProfiles(fresh)).toEqual([])
  expect(await fresh.attempts.count()).toBe(0)
  fresh.close()
})

test('when the database cannot be deleted, the data and the saved language stay', async () => {
  const db = openDatabase(`test-${crypto.randomUUID()}`)
  await createProfile(db, input, NOW)
  vi.spyOn(db, 'delete').mockRejectedValue(new Error('blocked'))
  await expect(deleteAllData(db)).rejects.toThrow('blocked')
  expect(saved.get(LOCALE_STORAGE_KEY)).toBe('pt-BR')
  expect(await listProfiles(db)).toHaveLength(1)
  db.close()
})

test('a storage that throws does not stop the deletion', async () => {
  const name = `test-${crypto.randomUUID()}`
  const db = openDatabase(name)
  await createProfile(db, input, NOW)
  vi.stubGlobal('localStorage', undefined)
  await expect(deleteAllData(db)).resolves.toBeUndefined()
  const fresh = openDatabase(name)
  expect(await listProfiles(fresh)).toEqual([])
  fresh.close()
})
