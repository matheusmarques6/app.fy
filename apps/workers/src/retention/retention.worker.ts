import type { Job } from 'bullmq'
import type { RetentionService } from '@appfy/core'
import type { Logger } from '../shared/logger.js'

export interface RetentionJobPayload {
  readonly type: 'daily_cleanup'
}

/**
 * Creates a processor function for the retention queue.
 *
 * Runs RetentionService.runAll() to clean expired data:
 * - notification_deliveries older than 180 days
 * - app_events older than 90 days
 *
 * Designed to run daily at 3am UTC via a cron job.
 */
export function createRetentionProcessor(retentionService: RetentionService, log: Logger) {
  return async (job: Job<RetentionJobPayload>): Promise<void> => {
    log.info('Starting retention cleanup', { jobId: job.id })

    const result = await retentionService.runAll()

    log.info('Retention cleanup completed', {
      jobId: job.id,
      deliveriesDeleted: result.deliveriesDeleted,
      eventsDeleted: result.eventsDeleted,
    })
  }
}
