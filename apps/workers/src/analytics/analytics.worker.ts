import type { Job } from 'bullmq'
import type { Dependencies, AnalyticsQueuePayload } from '@appfy/core'
import type { Logger } from '../shared/logger.js'

/** Known metric types for validation */
const KNOWN_METRIC_TYPES = new Set([
  'push_sent',
  'push_delivered',
  'push_opened',
  'push_clicked',
  'push_converted',
  'revenue',
  'app_opens',
  'device_registrations',
])

/**
 * Creates a processor function for the analytics queue.
 *
 * Responsibilities:
 * 1. Validate payload shape and metric type
 * 2. Log the received aggregation request with all metadata
 * 3. Aggregate metrics for the given tenant and period
 * 4. UPSERT aggregated data (idempotent -- reprocessing does not duplicate)
 *
 * Steps 3-4 remain as TODO stubs -- they depend on services not yet built.
 * On failure, BullMQ retries with exponential backoff (3 attempts).
 */
export function createAnalyticsProcessor(deps: Dependencies, log: Logger) {
  return async (job: Job<AnalyticsQueuePayload>): Promise<void> => {
    const { tenantId, metricType, period } = job.data

    log.info('Processing analytics aggregation', {
      jobId: job.id,
      tenantId,
      metricType,
      periodFrom: period.from,
      periodTo: period.to,
    })

    // Validate required fields
    if (!tenantId || !metricType) {
      log.error('Analytics aggregation failed — missing required fields', {
        jobId: job.id,
        tenantId,
        metricType,
        hasTenantId: Boolean(tenantId),
        hasMetricType: Boolean(metricType),
      })
      throw new Error('AnalyticsQueuePayload requires tenantId and metricType')
    }

    // Validate period
    if (!period.from || !period.to) {
      log.error('Analytics aggregation failed — invalid period', {
        jobId: job.id,
        tenantId,
        metricType,
        periodFrom: period.from,
        periodTo: period.to,
      })
      throw new Error('AnalyticsQueuePayload requires period.from and period.to')
    }

    // Validate known metric type
    if (!KNOWN_METRIC_TYPES.has(metricType)) {
      log.warn('Unknown metric type received', {
        jobId: job.id,
        tenantId,
        metricType,
      })
    }

    // TODO: Run aggregation queries for the given metric type and period
    // const metrics = await deps.analyticsService.aggregate(tenantId, metricType, period)

    // TODO: UPSERT aggregated metrics (idempotent)
    // await deps.analyticsService.upsertMetrics(tenantId, metricType, period, metrics)

    log.info('Analytics aggregation completed', {
      jobId: job.id,
      tenantId,
      metricType,
      periodFrom: period.from,
      periodTo: period.to,
    })
  }
}
