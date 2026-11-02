/**
 * Date handling for the planner, in local time throughout.
 *
 * Dates on the wire are plain `yyyy-MM-dd` — a `DateOnly` on the backend, a
 * calendar day with no zone. Parsing one with `new Date('2026-11-02')` would
 * read it as UTC midnight and shift it a day backwards for anyone west of
 * Greenwich, so the parts are split out by hand instead.
 */

export const WEEK_STARTS_ON_MONDAY = 1

export function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}

export function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)

  return new Date(year, month - 1, day)
}

export function addDays(date: Date, days: number): Date {
  const shifted = new Date(date)
  shifted.setDate(shifted.getDate() + days)

  return shifted
}

/** The Monday on or before `date`. */
export function startOfWeek(date: Date): Date {
  // getDay() is 0 for Sunday, which is 6 days into a Monday-first week.
  const offset = (date.getDay() - WEEK_STARTS_ON_MONDAY + 7) % 7

  return addDays(date, -offset)
}

export interface Week {
  /** yyyy-MM-dd of the Monday. */
  from: string
  /** yyyy-MM-dd of the Sunday. */
  to: string
  /** All seven days, Monday first. */
  days: string[]
}

export function weekOf(date: Date): Week {
  const monday = startOfWeek(date)
  const days = Array.from({ length: 7 }, (_, i) => toIsoDate(addDays(monday, i)))

  return { from: days[0], to: days[6], days }
}

export const shiftWeeks = (week: Week, by: number): Week =>
  weekOf(addDays(fromIsoDate(week.from), by * 7))

const dayName = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const dayNumber = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export const formatDayName = (iso: string) => dayName.format(fromIsoDate(iso))
export const formatDayNumber = (iso: string) => dayNumber.format(fromIsoDate(iso))
export const formatDate = (iso: string) => fullDate.format(fromIsoDate(iso))

export function formatRange(from: string, to: string): string {
  return `${formatDate(from)} – ${formatDate(to)}`
}

export const isToday = (iso: string) => iso === toIsoDate(new Date())
