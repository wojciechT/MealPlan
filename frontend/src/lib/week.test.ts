import { describe, expect, it } from 'vitest'
import { addDays, fromIsoDate, shiftWeeks, startOfWeek, toIsoDate, weekOf } from './week'

describe('fromIsoDate', () => {
  it('reads a wire date as a local calendar day', () => {
    // The bug this guards: new Date('2026-11-02') is UTC midnight, which is
    // 1 November for anyone west of Greenwich.
    const date = fromIsoDate('2026-11-02')

    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(10)
    expect(date.getDate()).toBe(2)
  })

  it('round-trips through toIsoDate', () => {
    for (const iso of ['2026-01-01', '2026-02-28', '2026-11-02', '2026-12-31']) {
      expect(toIsoDate(fromIsoDate(iso))).toBe(iso)
    }
  })
})

describe('startOfWeek', () => {
  it('returns the Monday of the week', () => {
    // 2026-11-02 is a Monday; 2026-11-08 is the Sunday that ends its week.
    expect(toIsoDate(startOfWeek(fromIsoDate('2026-11-02')))).toBe('2026-11-02')
    expect(toIsoDate(startOfWeek(fromIsoDate('2026-11-05')))).toBe('2026-11-02')
    expect(toIsoDate(startOfWeek(fromIsoDate('2026-11-08')))).toBe('2026-11-02')
  })

  it('treats Sunday as the end of the week, not the start', () => {
    expect(toIsoDate(startOfWeek(fromIsoDate('2026-11-01')))).toBe('2026-10-26')
  })
})

describe('weekOf', () => {
  it('spans Monday to Sunday with seven days', () => {
    const week = weekOf(fromIsoDate('2026-11-05'))

    expect(week.from).toBe('2026-11-02')
    expect(week.to).toBe('2026-11-08')
    expect(week.days).toHaveLength(7)
    expect(week.days[0]).toBe('2026-11-02')
    expect(week.days[6]).toBe('2026-11-08')
  })

  it('crosses a month boundary', () => {
    const week = weekOf(fromIsoDate('2026-10-29'))

    expect(week.from).toBe('2026-10-26')
    expect(week.to).toBe('2026-11-01')
  })

  it('crosses a year boundary', () => {
    const week = weekOf(fromIsoDate('2026-12-31'))

    expect(week.from).toBe('2026-12-28')
    expect(week.to).toBe('2027-01-03')
  })
})

describe('shiftWeeks', () => {
  it('steps whole weeks in both directions', () => {
    const week = weekOf(fromIsoDate('2026-11-02'))

    expect(shiftWeeks(week, 1).from).toBe('2026-11-09')
    expect(shiftWeeks(week, -1).from).toBe('2026-10-26')
    expect(shiftWeeks(week, 0).from).toBe('2026-11-02')
  })

  it('survives a daylight-saving change', () => {
    // Clocks go back in late October across most of Europe; stepping over it
    // must still land on a Monday rather than drifting an hour and a day.
    const week = weekOf(fromIsoDate('2026-10-19'))
    const next = shiftWeeks(week, 1)

    expect(next.from).toBe('2026-10-26')
    expect(fromIsoDate(next.from).getDay()).toBe(1)
  })
})

describe('addDays', () => {
  it('does not mutate its argument', () => {
    const date = fromIsoDate('2026-11-02')
    addDays(date, 5)

    expect(toIsoDate(date)).toBe('2026-11-02')
  })
})
