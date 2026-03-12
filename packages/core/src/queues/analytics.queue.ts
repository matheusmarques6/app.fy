/** Payload for the analytics queue */
export interface AnalyticsQueuePayload {
  readonly tenantId: string
  readonly metricType: string
  readonly period: {
    readonly from: string // ISO date
    readonly to: string // ISO date
  }
}

/** Queue configuration for analytics */
export const analyticsQueue = {
  name: 'analytics',
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 2000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
} as const
