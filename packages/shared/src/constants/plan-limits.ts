import type { PlanName } from './plans.js'

/** Plan limits for notifications and frequency capping */
export interface PlanLimit {
  /** Manual notifications per month (null = unlimited) */
  readonly manualNotificationsPerMonth: number | null
  /** Daily push limit per user (null = unlimited) */
  readonly dailyPushLimitPerUser: number | null
}

/** Plan limits by plan tier */
export const PLAN_LIMITS = Object.freeze({
  starter: {
    manualNotificationsPerMonth: 15,
    dailyPushLimitPerUser: 2,
  },
  business: {
    manualNotificationsPerMonth: null,
    dailyPushLimitPerUser: 4,
  },
  elite: {
    manualNotificationsPerMonth: null,
    dailyPushLimitPerUser: null,
  },
} as const satisfies Record<PlanName, PlanLimit>)

/** Frequency capping defaults */
export const FREQUENCY_CAPS = Object.freeze({
  /** Max cart_abandoned pushes per session */
  maxCartAbandonedPerSession: 1,
  /** Counter reset time (UTC midnight) */
  counterResetUtcHour: 0,
  /** Whether admin can override for manual campaigns */
  adminOverrideManual: true,
  /** Whether admin can override for automated flows */
  adminOverrideAutomated: false,
} as const)
