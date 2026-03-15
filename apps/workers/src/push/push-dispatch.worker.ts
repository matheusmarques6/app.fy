import type { Job } from 'bullmq'
import type { Dependencies, PushDispatchPayload } from '@appfy/core'
import type { Logger } from '../shared/logger.js'

/**
 * Creates a processor function for the push-dispatch queue.
 *
 * Responsibilities:
 * 1. Load tenant's OneSignal app ID
 * 2. Load notification for title/body
 * 3. Send push notification via OneSignal
 * 4. Update delivery records (status -> 'sent')
 *
 * On failure, BullMQ retries with exponential backoff (3 attempts).
 */
export function createPushDispatchProcessor(deps: Dependencies, log: Logger) {
  return async (job: Job<PushDispatchPayload>): Promise<void> => {
    const { notificationId, tenantId, batchTokens } = job.data

    log.info('Processing push dispatch', {
      jobId: job.id,
      notificationId,
      tenantId,
      tokenCount: batchTokens.length,
    })

    if (batchTokens.length === 0) {
      log.warn('Push dispatch skipped — no tokens in batch', {
        jobId: job.id,
        notificationId,
        tenantId,
      })
      return
    }

    // Load tenant to get OneSignal app ID
    const tenant = await deps.tenantService.findById(tenantId)

    // Load notification to get title and body
    const notification = await deps.notificationService.getById(tenantId, notificationId)

    // TenantRow.onesignalAppId is string | null
    const appId = tenant.onesignalAppId
    if (!appId) {
      log.error('Push dispatch failed — tenant has no OneSignal app ID', {
        jobId: job.id,
        notificationId,
        tenantId,
      })
      throw new Error(`Tenant ${tenantId} has no OneSignal app ID configured`)
    }

    // Send push via OneSignal provider
    const result = await deps.pushService.send(appId, {
      title: notification.title,
      body: notification.body,
      imageUrl: notification.imageUrl ?? undefined,
      targetUrl: notification.targetUrl ?? undefined,
      playerIds: batchTokens,
    })

    // Update delivery records scoped to this batch's tokens (H2: avoids race with concurrent batches)
    // Uses atomic updateManySent (H3: single DB call for status + externalId)
    const pendingDeliveries = await deps.deliveryRepo.findPendingByNotificationAndTokens(
      tenantId,
      notificationId,
      batchTokens,
    )
    if (pendingDeliveries.length > 0) {
      const deliveryIds = pendingDeliveries.map((d) => d.id)
      const sentAt = new Date()
      await deps.deliveryRepo.updateManySent(tenantId, deliveryIds, result.externalId, sentAt)
    }

    log.info('Push dispatch completed', {
      jobId: job.id,
      notificationId,
      tenantId,
      externalId: result.externalId,
      recipientCount: result.recipientCount,
      deliveriesUpdated: pendingDeliveries.length,
    })
  }
}
