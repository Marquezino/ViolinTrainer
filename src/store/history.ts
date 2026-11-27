// Loading what the pure progress rules need from storage.
import type { ProfileHistory } from '../progress/history'
import type { VtDatabase } from './db'
import type { ExerciseRecord, Unit } from './records'

export async function loadHistory(db: VtDatabase, profileId: string): Promise<ProfileHistory> {
  const [attempts, goals, repairs] = await Promise.all([
    db.attempts.where('profileId').equals(profileId).toArray(),
    db.goalSettings.where('profileId').equals(profileId).toArray(),
    db.streakRepairs.where('profileId').equals(profileId).toArray(),
  ])
  return { attempts, goals, repairs }
}

/**
 * Visible units in order, each with its visible exercises in order. `path` is
 * the exercise ids flattened in that order; exercises of a deleted unit are left out.
 */
export async function loadPath(
  db: VtDatabase,
): Promise<{ units: Unit[]; exercises: ExerciseRecord[]; path: string[] }> {
  const [allUnits, allExercises] = await Promise.all([db.units.toArray(), db.exercises.toArray()])
  const units = allUnits.filter((u) => u.deletedAt === null).sort((a, b) => a.order - b.order)
  const exercises: ExerciseRecord[] = []
  for (const unit of units) {
    exercises.push(
      ...allExercises
        .filter((e) => e.unitId === unit.id && e.deletedAt === null)
        .sort((a, b) => a.order - b.order),
    )
  }
  return { units, exercises, path: exercises.map((e) => e.id) }
}
