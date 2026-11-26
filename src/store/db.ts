import Dexie, { type DexieOptions, type Table } from 'dexie'
import type {
  Attempt,
  ExerciseRecord,
  GoalSetting,
  HintState,
  ManualUnlock,
  Profile,
  Settings,
  StreakRepair,
  Unit,
} from './records'

export const DB_NAME = 'violin-trainer'
export const SCHEMA_VERSION = 1

export type TableName =
  | 'profiles'
  | 'goalSettings'
  | 'settings'
  | 'units'
  | 'exercises'
  | 'attempts'
  | 'hintStates'
  | 'manualUnlocks'
  | 'streakRepairs'

// Used by backup to export and restore every table.
export const TABLE_NAMES: readonly TableName[] = [
  'profiles',
  'goalSettings',
  'settings',
  'units',
  'exercises',
  'attempts',
  'hintStates',
  'manualUnlocks',
  'streakRepairs',
]

export class VtDatabase extends Dexie {
  profiles!: Table<Profile, string>
  goalSettings!: Table<GoalSetting, string>
  settings!: Table<Settings, 'app'>
  units!: Table<Unit, string>
  exercises!: Table<ExerciseRecord, string>
  attempts!: Table<Attempt, string>
  hintStates!: Table<HintState, [string, string]>
  manualUnlocks!: Table<ManualUnlock, string>
  streakRepairs!: Table<StreakRepair, string>

  constructor(name: string, options?: DexieOptions) {
    super(name, options)
    this.version(SCHEMA_VERSION).stores({
      profiles: 'id',
      goalSettings: 'id, profileId',
      settings: 'id',
      units: 'id, order',
      exercises: 'id, unitId',
      attempts: 'id, profileId, exerciseId',
      hintStates: '[profileId+noteKey], profileId',
      manualUnlocks: 'id, profileId',
      streakRepairs: 'id, profileId',
    })
  }
}

/** `options` can supply another IndexedDB, e.g. an in-memory one when the browser's is unavailable. */
export function openDatabase(name: string = DB_NAME, options?: DexieOptions): VtDatabase {
  return new VtDatabase(name, options)
}

/**
 * When another tab deletes or upgrades the database, closes this tab's connection (so that tab
 * is not blocked) and calls `onGone`, normally a page reload: the screens shown are stale.
 */
export function closeOnVersionChange(db: VtDatabase, onGone: () => void): void {
  db.on('versionchange', () => {
    db.close()
    onGone()
  })
}
