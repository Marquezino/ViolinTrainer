import 'fake-indexeddb/auto'
import { beforeEach, expect, test } from 'vitest'
import { BUILTIN_UNITS, builtinExerciseId, type BuiltinUnit } from '../exercises/builtin-units'
import { SAMPLE_EXERCISES } from '../exercises/samples'
import { syncBuiltinUnits } from './builtin'
import { openDatabase, type VtDatabase } from './db'
import type { Attempt } from './records'

let db: VtDatabase
beforeEach(() => {
  db = openDatabase(`test-${crypto.randomUUID()}`)
})

const NOW = new Date(2026, 5, 10, 15).getTime()

test('first sync inserts both units and all eleven exercises with fixed ids', async () => {
  await syncBuiltinUnits(db, NOW)
  const units = await db.units.orderBy('order').toArray()
  expect(units.map((u) => u.id)).toEqual(['builtin-unit:first-steps', 'builtin-unit:traditional-tunes'])
  expect(units.map((u) => u.title)).toEqual(['First steps', 'Traditional tunes'])
  for (const u of units) {
    expect(u.source).toBe('builtin')
    expect(u.sourceVersion).toBe(1)
    expect(u.deletedAt).toBeNull()
  }
  const exercises = await db.exercises.toArray()
  expect(exercises).toHaveLength(11)
  const twinkle = await db.exercises.get('builtin:twinkle')
  expect(twinkle).toMatchObject({
    unitId: 'builtin-unit:first-steps',
    order: 4,
    title: 'Twinkle, Twinkle, Little Star (traditional)',
    abc: SAMPLE_EXERCISES.find((s) => s.id === 'twinkle')?.abc,
    transpose: 0,
    deletedAt: null,
  })
  const lightly = await db.exercises.get('builtin:lightly-row')
  expect(lightly).toMatchObject({ unitId: 'builtin-unit:traditional-tunes', order: 0 })
})

test('sync is idempotent', async () => {
  await syncBuiltinUnits(db, NOW)
  await syncBuiltinUnits(db, NOW + 1000)
  expect((await db.units.toArray()).every((u) => u.updatedAt === NOW)).toBe(true)
  const exercises = await db.exercises.toArray()
  expect(exercises).toHaveLength(11)
  expect(exercises.every((e) => e.updatedAt === NOW)).toBe(true)
})

test('a newer version updates in place, keeps ids, and soft-deletes removed exercises', async () => {
  await syncBuiltinUnits(db, NOW)
  const attempt: Attempt = {
    id: crypto.randomUUID(),
    profileId: 'p',
    exerciseId: builtinExerciseId('may-song'),
    startedAt: NOW,
    finishedAt: NOW + 1,
    completed: true,
    points: 1,
    maxPoints: 1,
    stars: 3,
    activeMs: 1,
    results: [],
  }
  await db.attempts.add(attempt)

  const v2: BuiltinUnit[] = BUILTIN_UNITS.map((u) =>
    u.key === 'traditional-tunes'
      ? {
          ...u,
          version: 2,
          // drops may-song, swaps the first two
          exercises: ['song-of-the-wind', 'lightly-row', 'go-tell-aunt-rhody', 'o-come-little-children', 'long-long-ago'],
        }
      : u,
  )
  const later = NOW + 5000
  await syncBuiltinUnits(db, later, v2)

  const dropped = await db.exercises.get('builtin:may-song')
  expect(dropped?.deletedAt).toBe(later)
  expect((await db.exercises.get('builtin:song-of-the-wind'))).toMatchObject({ order: 0, deletedAt: null })
  expect((await db.exercises.get('builtin:lightly-row'))).toMatchObject({ order: 1, deletedAt: null })
  expect((await db.exercises.get('builtin:long-long-ago'))).toMatchObject({ order: 4, deletedAt: null })
  expect(await db.exercises.count()).toBe(11)

  const unit = await db.units.get('builtin-unit:traditional-tunes')
  expect(unit).toMatchObject({ sourceVersion: 2, updatedAt: later, createdAt: NOW })
  expect((await db.units.get('builtin-unit:first-steps'))?.updatedAt).toBe(NOW)
  expect(await db.attempts.get(attempt.id)).toEqual(attempt)

  // Restoring the exercise in a later version brings it back.
  await syncBuiltinUnits(db, later + 1, BUILTIN_UNITS.map((u) => ({ ...u, version: 3 })))
  expect(await db.exercises.get('builtin:may-song')).toMatchObject({ deletedAt: null, order: 4 })
})

test('an older version in code never downgrades the stored unit', async () => {
  const v2 = BUILTIN_UNITS.map((u) => ({ ...u, version: 2, exercises: u.exercises.slice(1) }))
  await syncBuiltinUnits(db, NOW, v2)
  await syncBuiltinUnits(db, NOW + 1000)
  const units = await db.units.toArray()
  expect(units.every((u) => u.sourceVersion === 2 && u.updatedAt === NOW)).toBe(true)
  expect(await db.exercises.get('builtin:open-strings')).toBeUndefined()
  expect(await db.exercises.count()).toBe(9)
})
