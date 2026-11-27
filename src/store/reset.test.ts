import 'fake-indexeddb/auto'
import { IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { LOCALE_STORAGE_KEY } from '../i18n/saved-locale'
import { closeOnVersionChange, openDatabase } from './db'
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

/** The real IndexedDB, except that deleting a database fails the way a browser reports it. */
function failingDeletes(): IDBFactory {
  return {
    open: (name: string, version?: number) => indexedDB.open(name, version),
    cmp: (a: unknown, b: unknown) => indexedDB.cmp(a, b),
    databases: () => indexedDB.databases(),
    deleteDatabase: () => {
      const request = {} as IDBOpenDBRequest & { error: DOMException }
      request.error = new DOMException('The disk is full', 'UnknownError')
      setTimeout(() => request.onerror?.({ target: request } as unknown as Event))
      return request
    },
  } as IDBFactory
}

test('when the database cannot be deleted, it keeps working and the saved language stays', async () => {
  const db = openDatabase(`test-${crypto.randomUUID()}`, { indexedDB: failingDeletes(), IDBKeyRange })
  await createProfile(db, input, NOW)
  await expect(deleteAllData(db)).rejects.toThrow('The disk is full')
  expect(saved.get(LOCALE_STORAGE_KEY)).toBe('pt-BR')
  // Still usable: no DatabaseClosedError for the screens that keep running.
  expect(await listProfiles(db)).toHaveLength(1)
  await createProfile(db, { ...input, name: 'Player B' }, NOW)
  expect(await listProfiles(db)).toHaveLength(2)
  db.close()
})

test('a delete blocked by another open connection reports it, then finishes once that one closes', async () => {
  const name = `test-${crypto.randomUUID()}`
  const db = openDatabase(name)
  await createProfile(db, input, NOW)
  // A connection that does not close itself when asked, like an old tab.
  const other = await new Promise<IDBDatabase>((resolve) => {
    const request = indexedDB.open(name)
    request.onsuccess = () => resolve(request.result)
  })
  const onBlocked = vi.fn()
  const deleting = deleteAllData(db, { onBlocked })
  await vi.waitFor(() => expect(onBlocked).toHaveBeenCalledTimes(1))
  expect(saved.get(LOCALE_STORAGE_KEY)).toBe('pt-BR')
  other.close()
  await deleting
  expect(saved.has(LOCALE_STORAGE_KEY)).toBe(false)
  const fresh = openDatabase(name)
  expect(await listProfiles(fresh)).toEqual([])
  fresh.close()
})

test('a delete that takes too long is reported as blocked', async () => {
  const db = openDatabase(`test-${crypto.randomUUID()}`)
  await createProfile(db, input, NOW)
  let finish = () => {}
  vi.spyOn(db, 'delete').mockReturnValue(new Promise<void>((resolve) => (finish = resolve)) as never)
  const onBlocked = vi.fn()
  const deleting = deleteAllData(db, { onBlocked, blockedAfterMs: 20 })
  await vi.waitFor(() => expect(onBlocked).toHaveBeenCalledTimes(1))
  finish()
  await deleting
  expect(onBlocked).toHaveBeenCalledTimes(1)
})

test('another tab deleting the database makes this one close it and reload', async () => {
  const name = `test-${crypto.randomUUID()}`
  const here = openDatabase(name)
  await createProfile(here, input, NOW)
  const reload = vi.fn()
  closeOnVersionChange(here, reload)
  const elsewhere = openDatabase(name)
  await elsewhere.open()
  await deleteAllData(elsewhere)
  expect(reload).toHaveBeenCalledTimes(1)
  expect(here.isOpen()).toBe(false)
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
