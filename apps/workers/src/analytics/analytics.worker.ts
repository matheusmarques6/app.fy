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
 * 4. Log aggregated results (MVP: on-the-fly via existing repo queries)
 *
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

    // Aggregate metrics via the analytics service
    const analyticsPeriod = {
      from: new Date(period.from),
      to: new Date(period.to),
    }

    const overview = await deps.analyticsService.aggregate(tenantId, analyticsPeriod)

    log.info('Analytics aggregation completed', {
      jobId: job.id,
      tenantId,
      metricType,
      periodFrom: period.from,
      periodTo: period.to,
      totalSent: overview.totalSent,
      totalDelivered: overview.totalDelivered,
      totalConverted: overview.totalConverted,
      deliveryRate: overview.deliveryRate,
      conversionRate: overview.conversionRate,
    })
  }
}
