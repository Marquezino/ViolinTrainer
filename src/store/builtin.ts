import { BUILTIN_UNITS, builtinExerciseId, type BuiltinUnit, type BuiltinUnitId } from '../exercises/builtin-units'
import { SAMPLE_EXERCISES, type SampleId } from '../exercises/samples'
import type { VtDatabase } from './db'
import type { ExerciseRecord, Unit } from './records'

// Stored titles are English; the UI translates them through unitKeyOf and sampleIdOf.
const UNIT_TITLES: Record<BuiltinUnitId, string> = {
  'first-steps': 'First steps',
  'traditional-tunes': 'Traditional tunes',
}

function sampleOf(id: SampleId): { title: string; abc: string } {
  const sample = SAMPLE_EXERCISES.find((s) => s.id === id)
  if (!sample) throw new Error(`unknown sample ${id}`)
  const title = /^T:(.*)$/m.exec(sample.abc)?.[1].trim() ?? id
  return { title, abc: sample.abc }
}

/**
 * Inserts missing built-in units and updates in place those whose code version
 * is newer than the stored one. Exercises keep their fixed ids, so attempts,
 * unlocks and hints stay attached; dropped exercises are only soft-deleted.
 */
export async function syncBuiltinUnits(
  db: VtDatabase,
  now: number,
  units: readonly BuiltinUnit[] = BUILTIN_UNITS,
): Promise<void> {
  await db.transaction('rw', db.units, db.exercises, async () => {
    for (const [order, unit] of units.entries()) {
      const stored = await db.units.get(unit.id)
      if (stored && (stored.sourceVersion ?? 0) >= unit.version) continue

      const record: Unit = {
        id: unit.id,
        title: UNIT_TITLES[unit.key],
        order: stored?.order ?? order,
        source: 'builtin',
        sourceVersion: unit.version,
        createdAt: stored?.createdAt ?? now,
        updatedAt: now,
        deletedAt: stored?.deletedAt ?? null,
      }
      await db.units.put(record)

      const existing = new Map(
        (await db.exercises.where('unitId').equals(unit.id).toArray()).map((e) => [e.id, e]),
      )
      const listed = new Set<string>()
      for (const [index, sampleId] of unit.exercises.entries()) {
        const id = builtinExerciseId(sampleId)
        listed.add(id)
        const prev = existing.get(id) ?? (await db.exercises.get(id))
        const exercise: ExerciseRecord = {
          id,
          unitId: unit.id,
          order: index,
          ...sampleOf(sampleId),
          transpose: 0,
          createdAt: prev?.createdAt ?? now,
          updatedAt: now,
          deletedAt: null,
        }
        await db.exercises.put(exercise)
      }
      for (const e of existing.values()) {
        if (!listed.has(e.id) && e.deletedAt === null) {
          await db.exercises.put({ ...e, deletedAt: now, updatedAt: now })
        }
      }
    }
  })
}
