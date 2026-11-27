// Stored record types and goal constants. Types and constants only: pure
// modules elsewhere import this file and must not pull in Dexie.
import type { Locale } from '../i18n/locales'
import type { Stars } from '../practice/scoring'

export type { Day } from '../progress/days'
import type { Day } from '../progress/days'

export const GOAL_MIN = 5
export const GOAL_MAX = 60
export const GOAL_STEP = 5
export const DEFAULT_GOAL_MINUTES = 10

export type Avatar =
  | 'violin' | 'note' | 'clef' | 'star' | 'sun' | 'moon'
  | 'bird' | 'cat' | 'dog' | 'flower' | 'tree' | 'heart'

export interface Profile {
  id: string
  name: string
  avatar: Avatar
  greenCents: number
  yellowCents: number
  locale: Locale
  skipTuning: boolean
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface GoalSetting {
  id: string
  profileId: string
  minutes: number
  fromDay: Day
  createdAt: number
}

export interface Settings {
  id: 'app'
  a4Hz: number
  /**
   * Reserved for later: written on each closed run, but nothing reads it yet.
   * The picker's language still comes from the saved locale.
   */
  lastProfileId: string | null
  lastBackupAt: number | null
  backupReminderDismissedAt: number | null
}

export type UnitSource = 'builtin' | 'imported' | 'local'

export interface Unit {
  id: string
  title: string
  order: number
  source: UnitSource
  sourceVersion: number | null
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface ExerciseRecord {
  id: string
  unitId: string
  order: number
  title: string
  abc: string
  transpose: number
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface TargetResult {
  targetId: number
  color: 'green' | 'yellow' | null
  redAttempts: number
  centsAtAcceptance: number | null
}

// finishedAt === null: the run is still open, or the app died before it
// closed. Its activeMs still counts.
export interface Attempt {
  id: string
  profileId: string
  exerciseId: string
  startedAt: number
  finishedAt: number | null
  completed: boolean
  points: number
  maxPoints: number
  stars: Stars
  activeMs: number
  results: TargetResult[]
}

export interface HintState {
  profileId: string
  noteKey: string
  consecutiveFirstTryGreens: number
  updatedAt: number
}

export interface ManualUnlock {
  id: string
  profileId: string
  exerciseId: string
  createdAt: number
}

export type StreakKind = 'easy' | 'practice'

export interface StreakRepair {
  id: string
  profileId: string
  streak: StreakKind
  day: Day
  cost: number
  createdAt: number
}
