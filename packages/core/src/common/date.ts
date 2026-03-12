/** Returns current timestamp as Date */
export function now(): Date {
  return new Date()
}

/** Adds seconds to a date, returns new Date */
export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000)
}

/** Checks whether a date is in the past */
export function isExpired(date: Date): boolean {
  return date.getTime() < Date.now()
}
