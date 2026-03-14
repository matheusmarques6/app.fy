import type { Job } from 'bullmq'
import type { Dependencies, DataIngestionPayload } from '@appfy/core'
import type { Logger } from '../shared/logger.js'

/** Known event types for validation */
const KNOWN_EVENT_TYPES = new Set([
  'cart_abandoned',
  'order_pending_pix',
  'order_pending_boleto',
  'app_opened',
  'checkout_abandoned',
  'order_paid',
  'fulfillment_created',
  'product_viewed',
  'order_delivered',
  'add_to_cart',
  'purchase_completed',
  'push_opened',
  'push_clicked',
])

/**
 * Creates a processor function for the data-ingestion queue.
 *
 * Responsibilities:
 * 1. Validate payload shape and event type
 * 2. Log the received event with all metadata
 * 3. Route events by eventType (webhook processing, flow triggers)
 * 4. Deduplicate events within 5s window
 * 5. Trigger appropriate automation flows
 *
 * Steps 3-5 remain as TODO stubs — they depend on services not yet built.
 * On failure, BullMQ retries with exponential backoff (3 attempts).
 */
export function createDataIngestionProcessor(deps: Dependencies, log: Logger) {
  return async (job: Job<DataIngestionPayload>): Promise<void> => {
    const { tenantId, eventType, payload, source } = job.data

    log.info('Processing data ingestion', {
      jobId: job.id,
      tenantId,
      eventType,
      source,
      payloadKeys: Object.keys(payload),
    })

    // Validate required fields
    if (!tenantId || !eventType) {
      log.error('Data ingestion failed — missing required fields', {
        jobId: job.id,
        tenantId,
        eventType,
        hasTenantId: Boolean(tenantId),
        hasEventType: Boolean(eventType),
      })
      throw new Error('DataIngestionPayload requires tenantId and eventType')
    }

    // Validate known event type
    if (!KNOWN_EVENT_TYPES.has(eventType)) {
      log.warn('Unknown event type received', {
        jobId: job.id,
        tenantId,
        eventType,
        source,
      })
    }

    // TODO: Dedup check — skip if same event within 5s window
    // const isDuplicate = await deps.eventService.isDuplicate(tenantId, eventType, payload, 5000)
    // if (isDuplicate) {
    //   log.info('Duplicate event skipped', { jobId: job.id, tenantId, eventType })
    //   return
    // }

    // TODO: Persist event
    // await deps.eventService.create({ tenantId, eventType, payload, source })

    // TODO: Route by event type and trigger flows
    // switch (eventType) {
    //   case 'cart_abandoned':
    //     await deps.automationService.triggerFlow(tenantId, 'cart_abandoned', payload)
    //     break
    //   case 'order_pending_pix':
    //     await deps.automationService.triggerFlow(tenantId, 'pix_recovery', payload)
    //     break
    //   case 'order_pending_boleto':
    //     await deps.automationService.triggerFlow(tenantId, 'boleto_recovery', payload)
    //     break
    //   case 'app_opened':
    //     // First app_opened -> trigger welcome flow
    //     break
    //   case 'checkout_abandoned':
    //     await deps.automationService.triggerFlow(tenantId, 'checkout_abandoned', payload)
    //     break
    //   case 'order_paid':
    //     await deps.automationService.triggerFlow(tenantId, 'order_confirmed', payload)
    //     break
    //   case 'fulfillment_created':
    //     await deps.automationService.triggerFlow(tenantId, 'tracking_created', payload)
    //     break
    //   case 'product_viewed':
    //     // Schedule browse_abandoned check after 2-4h
    //     break
    //   case 'order_delivered':
    //     await deps.automationService.triggerFlow(tenantId, 'upsell', payload)
    //     break
    // }

    log.info('Data ingestion completed', {
      jobId: job.id,
      tenantId,
      eventType,
      source,
    })
  }
}
