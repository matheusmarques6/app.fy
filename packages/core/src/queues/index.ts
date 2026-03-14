export type { AnalyticsQueuePayload } from './analytics.queue.js'
export { analyticsQueue } from './analytics.queue.js'
export type { BuildQueuePayload } from './build.queue.js'
export { buildQueue } from './build.queue.js'
export type { DataIngestionPayload } from './data-ingestion.queue.js'
export { dataIngestionQueue } from './data-ingestion.queue.js'
export type { PushDispatchPayload } from './push-dispatch.queue.js'
export { pushDispatchQueue } from './push-dispatch.queue.js'
export type { RetentionQueuePayload } from './retention.queue.js'
export { retentionQueue } from './retention.queue.js'

/** All queue names for easy registration */
export const queueNames = ['push-dispatch', 'data-ingestion', 'analytics', 'build', 'retention'] as const

export type QueueName = (typeof queueNames)[number]
