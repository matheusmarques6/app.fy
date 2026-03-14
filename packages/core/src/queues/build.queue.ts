/** Payload for the build queue */
export interface BuildQueuePayload {
  readonly tenantId: string
  readonly appConfigId: string
  readonly triggeredBy: string
}

/** Queue configuration for build */
export const buildQueue = {
  name: 'build',
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
} as const
