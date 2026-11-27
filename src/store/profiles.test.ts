import 'fake-indexeddb/auto'
import { beforeEach, expect, test } from 'vitest'
import { localDay } from '../progress/days'
import { goalMinutesOn } from '../progress/history'
import { openDatabase, type VtDatabase } from './db'
import {
  createProfile,
  deleteProfile,
  getSettings,
  listProfiles,
  setGoal,
  updateProfile,
  updateSettings,
} from './profiles'

let db: VtDatabase
beforeEach(() => {
  db = openDatabase(`test-${crypto.randomUUID()}`)
})

const NOW = new Date(2026, 5, 10, 15).getTime()
const input = { name: 'Player A', avatar: 'violin', locale: 'en' } as const

test('createProfile gives a UUID, default tolerances, and a 10-minute goal from today', async () => {
  const p = await createProfile(db, input, NOW)
  expect(p.id).toMatch(/^[0-9a-f-]{36}$/)
  expect(p.greenCents).toBe(20)
  expect(p.yellowCents).toBe(35)
  expect(p.skipTuning).toBe(false)
  const goals = await db.goalSettings.where('profileId').equals(p.id).toArray()
  expect(goals).toHaveLength(1)
  expect(goals[0].minutes).toBe(10)
  expect(goals[0].fromDay).toBe(localDay(NOW))
})

test('deleteProfile hides the profile but keeps the record', async () => {
  const p = await createProfile(db, input, NOW)
  const q = await createProfile(db, { ...input, name: 'Player B' }, NOW + 1)
  await deleteProfile(db, p.id, NOW + 2)
  expect((await listProfiles(db)).map((x) => x.id)).toEqual([q.id])
  expect(typeof (await db.profiles.get(p.id))?.deletedAt).toBe('number')
})

test('listProfiles is ordered by creation time', async () => {
  const a = await createProfile(db, input, NOW + 5)
  const b = await createProfile(db, input, NOW)
  expect((await listProfiles(db)).map((x) => x.id)).toEqual([b.id, a.id])
})

test('updateProfile changes fields and updatedAt', async () => {
  const p = await createProfile(db, input, NOW)
  await updateProfile(db, p.id, { name: 'Player C', skipTuning: true }, NOW + 10)
  const got = await db.profiles.get(p.id)
  expect(got).toMatchObject({ name: 'Player C', skipTuning: true, updatedAt: NOW + 10, createdAt: NOW })
})

test('setGoal rejects values outside 5..60 or off the 5-minute step', async () => {
  const p = await createProfile(db, input, NOW)
  const day = localDay(NOW)
  for (const bad of [4, 61, 12]) {
    await expect(setGoal(db, p.id, bad, day, NOW)).rejects.toBeInstanceOf(RangeError)
  }
  await setGoal(db, p.id, 5, day, NOW)
  await setGoal(db, p.id, 60, day, NOW)
})

test('setGoal twice on one day keeps both dated records, and the later one is in force', async () => {
  const p = await createProfile(db, input, NOW)
  const day = '2026-06-11'
  await setGoal(db, p.id, 15, day, NOW)
  await setGoal(db, p.id, 20, day, NOW + 1)
  const goals = await db.goalSettings.where('profileId').equals(p.id).toArray()
  const rows = goals.filter((g) => g.fromDay === day)
  expect(rows.map((g) => g.minutes).sort()).toEqual([15, 20])
  expect(goalMinutesOn(goals, day)).toBe(20)
})

test('getSettings creates defaults once', async () => {
  const s = await getSettings(db)
  expect(s.a4Hz).toBe(440)
  await getSettings(db)
  expect(await db.settings.count()).toBe(1)
  await updateSettings(db, { a4Hz: 442 })
  expect((await getSettings(db)).a4Hz).toBe(442)
})
