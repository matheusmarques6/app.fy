/** Payload for the data-ingestion queue */
export interface DataIngestionPayload {
  readonly tenantId: string
  readonly eventType: string
  readonly payload: Record<string, unknown>
  readonly source: string
}

/** Queue configuration for data-ingestion */
export const dataIngestionQueue = {
  name: 'data-ingestion',
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 1000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
} as const
