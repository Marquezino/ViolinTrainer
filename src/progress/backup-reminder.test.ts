import { describe, expect, it } from 'vitest'
import { REMIND_AFTER_MS, SNOOZE_MS, shouldShowBackupReminder } from './backup-reminder'

const DAY = 86_400_000
const now = 100 * DAY
const s = { hasAttempts: true, lastBackupAt: null, dismissedAt: null, now }

describe('shouldShowBackupReminder', () => {
  it('uses 14 and 7 days', () => {
    expect(REMIND_AFTER_MS).toBe(14 * DAY)
    expect(SNOOZE_MS).toBe(7 * DAY)
  })
  it('is false with no attempts', () => {
    expect(shouldShowBackupReminder({ ...s, hasAttempts: false })).toBe(false)
  })
  it('is true when never backed up', () => {
    expect(shouldShowBackupReminder(s)).toBe(true)
  })
  it('waits 14 days after a backup', () => {
    expect(shouldShowBackupReminder({ ...s, lastBackupAt: now - 13 * DAY })).toBe(false)
    expect(shouldShowBackupReminder({ ...s, lastBackupAt: now - 14 * DAY })).toBe(true)
  })
  it('stays quiet for 7 days after a dismissal', () => {
    expect(shouldShowBackupReminder({ ...s, dismissedAt: now - 6 * DAY })).toBe(false)
    expect(shouldShowBackupReminder({ ...s, dismissedAt: now - 7 * DAY })).toBe(true)
  })
})
