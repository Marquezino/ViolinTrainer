import 'fake-indexeddb/auto'
import { beforeEach, expect, test } from 'vitest'
import { openDatabase, type VtDatabase } from './db'
import { loadPath } from './history'
import type { ExerciseRecord, Unit } from './records'

let db: VtDatabase
beforeEach(() => {
  db = openDatabase(`test-${crypto.randomUUID()}`)
})

const unit = (id: string, order: number, deletedAt: number | null = null): Unit => ({
  id,
  title: id,
  order,
  source: 'local',
  sourceVersion: null,
  createdAt: 1,
  updatedAt: 1,
  deletedAt,
})

const exercise = (id: string, unitId: string, order: number, deletedAt: number | null = null): ExerciseRecord => ({
  id,
  unitId,
  order,
  title: id,
  abc: '',
  transpose: 0,
  createdAt: 1,
  updatedAt: 1,
  deletedAt,
})

test('loadPath orders units and exercises and hides deleted ones', async () => {
  await db.units.bulkAdd([unit('u2', 2), unit('gone', 0, 5), unit('u1', 1)])
  await db.exercises.bulkAdd([
    exercise('u2-b', 'u2', 1),
    exercise('u2-a', 'u2', 0),
    exercise('u1-c', 'u1', 2),
    exercise('u1-dropped', 'u1', 1, 5),
    exercise('u1-a', 'u1', 0),
    exercise('gone-a', 'gone', 0),
  ])
  const { units, exercises, path } = await loadPath(db)
  expect(units.map((u) => u.id)).toEqual(['u1', 'u2'])
  expect(exercises.map((e) => e.id)).toEqual(['u1-a', 'u1-c', 'u2-a', 'u2-b'])
  expect(path).toEqual(['u1-a', 'u1-c', 'u2-a', 'u2-b'])
})

test('loadPath with no units is empty', async () => {
  expect(await loadPath(db)).toEqual({ units: [], exercises: [], path: [] })
})
