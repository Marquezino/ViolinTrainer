import { DEFAULT_A4_HZ, DEFAULT_TOLERANCES } from '../music/pitch'
import { localDay } from '../progress/days'
import type { Locale } from '../i18n/locales'
import type { VtDatabase } from './db'
import {
  DEFAULT_GOAL_MINUTES,
  GOAL_MAX,
  GOAL_MIN,
  GOAL_STEP,
  type Avatar,
  type Day,
  type Profile,
  type Settings,
} from './records'

export { DEFAULT_GOAL_MINUTES, GOAL_MAX, GOAL_MIN, GOAL_STEP }

export const DEFAULT_SETTINGS: Omit<Settings, 'id'> = {
  a4Hz: DEFAULT_A4_HZ,
  lastProfileId: null,
  lastBackupAt: null,
  backupReminderDismissedAt: null,
}

export async function getSettings(db: VtDatabase): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const existing = await db.settings.get('app')
    if (existing) return existing
    const created: Settings = { id: 'app', ...DEFAULT_SETTINGS }
    await db.settings.add(created)
    return created
  })
}

export async function updateSettings(
  db: VtDatabase,
  patch: Partial<Omit<Settings, 'id'>>,
): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = await getSettings(db)
    await db.settings.put({ ...current, ...patch })
  })
}

export async function createProfile(
  db: VtDatabase,
  input: { name: string; avatar: Avatar; locale: Locale },
  now: number,
): Promise<Profile> {
  const profile: Profile = {
    id: crypto.randomUUID(),
    name: input.name,
    avatar: input.avatar,
    greenCents: DEFAULT_TOLERANCES.greenCents,
    yellowCents: DEFAULT_TOLERANCES.yellowCents,
    locale: input.locale,
    skipTuning: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  await db.transaction('rw', db.profiles, db.goalSettings, async () => {
    await db.profiles.add(profile)
    await db.goalSettings.add({
      id: crypto.randomUUID(),
      profileId: profile.id,
      minutes: DEFAULT_GOAL_MINUTES,
      fromDay: localDay(now),
      createdAt: now,
    })
  })
  return profile
}

export async function updateProfile(
  db: VtDatabase,
  id: string,
  patch: Partial<
    Pick<Profile, 'name' | 'avatar' | 'greenCents' | 'yellowCents' | 'locale' | 'skipTuning'>
  >,
  now: number,
): Promise<void> {
  await db.profiles.update(id, { ...patch, updatedAt: now })
}

// Soft delete: the record and its attempts stay, so a backup can still restore them.
export async function deleteProfile(db: VtDatabase, id: string, now: number): Promise<void> {
  await db.profiles.update(id, { deletedAt: now, updatedAt: now })
}

export async function listProfiles(db: VtDatabase): Promise<Profile[]> {
  const all = await db.profiles.toArray()
  return all.filter((p) => p.deletedAt === null).sort((a, b) => a.createdAt - b.createdAt)
}

export async function setGoal(
  db: VtDatabase,
  profileId: string,
  minutes: number,
  today: Day,
  now: number,
): Promise<void> {
  if (!Number.isInteger(minutes) || minutes < GOAL_MIN || minutes > GOAL_MAX || minutes % GOAL_STEP !== 0) {
    throw new RangeError(`Goal must be ${GOAL_MIN} to ${GOAL_MAX} minutes in steps of ${GOAL_STEP}`)
  }
  // Dated, append-only records (§4.2): a second change today adds a row, and
  // goalMinutesOn prefers the newest createdAt on the same day.
  await db.goalSettings.add({ id: crypto.randomUUID(), profileId, minutes, fromDay: today, createdAt: now })
}
