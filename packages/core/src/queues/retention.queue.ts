/** Payload for the retention queue */
export interface RetentionQueuePayload {
  readonly type: 'daily_cleanup'
}

/** Queue configuration for data retention jobs */
export const retentionQueue = {
  name: 'retention',
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
} as const
