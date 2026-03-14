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

    // TODO: TenantRow does not yet include onesignalAppId — use tenantId as placeholder
    const appId = (tenant as unknown as Record<string, unknown>).onesignalAppId as string | undefined
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

    log.info('Push dispatch completed', {
      jobId: job.id,
      notificationId,
      tenantId,
      externalId: result.externalId,
      recipientCount: result.recipientCount,
    })

    // TODO: Update delivery records with sent status
    // await deps.notificationService.markDeliveriesSent(notificationId, batchTokens)
  }
}
