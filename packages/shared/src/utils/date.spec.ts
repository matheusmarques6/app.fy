import { describe, expect, it } from 'vitest'

import { diffInSeconds, isFuture, isPast, toIsoString } from './date.js'

describe('isPast', () => {
  it('should return true for past dates', () => {
    expect(isPast(new Date('2020-01-01'))).toBe(true)
  })

  it('should return false for future dates', () => {
    expect(isPast(new Date('2099-01-01'))).toBe(false)
  })
})

describe('isFuture', () => {
  it('should return true for future dates', () => {
    expect(isFuture(new Date('2099-01-01'))).toBe(true)
  })

  it('should return false for past dates', () => {
    expect(isFuture(new Date('2020-01-01'))).toBe(false)
  })
})

describe('diffInSeconds', () => {
  it('should return absolute difference in seconds', () => {
    const a = new Date('2026-01-01T00:00:00Z')
    const b = new Date('2026-01-01T00:01:00Z')
    expect(diffInSeconds(a, b)).toBe(60)
    expect(diffInSeconds(b, a)).toBe(60)
  })
})

describe('toIsoString', () => {
  it('should format without milliseconds', () => {
    const date = new Date('2026-03-11T12:00:00.123Z')
    expect(toIsoString(date)).toBe('2026-03-11T12:00:00Z')
  })
})
