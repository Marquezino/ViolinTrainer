// Local calendar days. A Day is 'YYYY-MM-DD' in the device's time zone.
// Arithmetic works on the calendar date (at local noon), never by adding 24 h,
// so daylight-saving changes cannot skip or repeat a day.
export type Day = string

const pad = (n: number): string => String(n).padStart(2, '0')

function format(date: Date): Day {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parse(day: Day): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function localDay(ms: number): Day {
  return format(new Date(ms))
}

export function addDays(day: Day, n: number): Day {
  const date = parse(day)
  date.setDate(date.getDate() + n)
  return format(date)
}

/** The Monday on or before `day`. */
export function weekStart(day: Day): Day {
  const sinceMonday = (parse(day).getDay() + 6) % 7
  return addDays(day, -sinceMonday)
}

/** The 7 days of the week of `day`, Monday to Sunday. */
export function daysOfWeek(day: Day): Day[] {
  const monday = weekStart(day)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function compareDays(a: Day, b: Day): number {
  return a < b ? -1 : a > b ? 1 : 0
}
