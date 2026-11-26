import { expect, test } from 'vitest'
import { addDays, daysOfWeek, localDay, weekStart } from './days'

// vite.config.ts runs tests in America/New_York, a zone with daylight saving.

test('localDay uses local time', () => {
  expect(localDay(new Date(2026, 2, 8, 23, 59).getTime())).toBe('2026-03-08')
})

test('addDays crosses DST changes without skipping or repeating', () => {
  expect(addDays('2026-03-07', 1)).toBe('2026-03-08')
  expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
  expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
})

test('weekStart is Monday', () => {
  expect(weekStart('2026-11-29')).toBe('2026-11-23')
  expect(weekStart('2026-11-23')).toBe('2026-11-23')
})

test('daysOfWeek returns Monday..Sunday', () => {
  const days = daysOfWeek('2026-11-26')
  expect(days).toHaveLength(7)
  expect(days[0]).toBe('2026-11-23')
  expect(days[6]).toBe('2026-11-29')
})

test('tests run in America/New_York, so DST is exercised', () => {
  expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(300)
  expect(new Date(2026, 6, 15).getTimezoneOffset()).toBe(240)
})

test('localDay just after midnight is the new day', () => {
  expect(localDay(new Date(2026, 10, 2, 0, 1).getTime())).toBe('2026-11-02')
})
