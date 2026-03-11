/**
 * Check if a date is in the past.
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now()
}

/**
 * Check if a date is in the future.
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now()
}

/**
 * Get the difference in seconds between two dates.
 */
export function diffInSeconds(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 1000
}

/**
 * Format a date to ISO string without milliseconds (API standard).
 * @example toIsoString(new Date()) // "2026-03-11T12:00:00Z"
 */
export function toIsoString(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}
