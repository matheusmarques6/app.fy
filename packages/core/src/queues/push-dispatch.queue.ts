/** Payload for the push-dispatch queue */
export interface PushDispatchPayload {
  readonly notificationId: string
  readonly tenantId: string
  readonly batchTokens: string[]
}

/** Queue configuration for push-dispatch */
export const pushDispatchQueue = {
  name: 'push-dispatch',
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 1000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
} as const
