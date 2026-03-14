import type { DeliveryStatus } from '@appfy/shared'
import type { DeviceRepository, DeviceRow } from '../devices/repository.js'
import { NotificationNotFoundError } from '../errors.js'
import type { AuditLogger } from '../notifications/service.js'
import type { Notification } from '../notifications/types.js'
import type { PushProvider, PushNotificationPayload } from './push-provider.interface.js'

/** Delivery repository interface for push dispatch */
export interface DeliveryRepository {
  create(tenantId: string, notificationId: string, deviceId: string, appUserId?: string): Promise<DeliveryRow>
  createMany(tenantId: string, records: CreateDeliveryInput[]): Promise<DeliveryRow[]>
  updateStatus(tenantId: string, id: string, status: DeliveryStatus, timestamp?: Date): Promise<void>
  updateManyStatus(tenantId: string, ids: string[], status: DeliveryStatus, timestamp?: Date): Promise<void>
}

export interface CreateDeliveryInput {
  readonly notificationId: string
  readonly deviceId: string
  readonly appUserId?: string
}

export interface DeliveryRow {
  readonly id: string
  readonly tenantId: string
  readonly notificationId: string
  readonly deviceId: string
  readonly appUserId: string | null
  readonly status: DeliveryStatus
  readonly sentAt: Date | null
  readonly deliveredAt: Date | null
  readonly openedAt: Date | null
  readonly clickedAt: Date | null
  readonly convertedAt: Date | null
  readonly errorMessage: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

/** Notification repository interface needed by dispatch */
export interface NotificationLookup {
  findById(tenantId: string, id: string): Promise<Notification | undefined>
}

/** Tenant lookup for OneSignal app ID */
export interface TenantLookup {
  findById(tenantId: string): Promise<{ onesignalAppId: string | null } | undefined>
}

export interface PushDispatchResult {
  readonly notificationId: string
  readonly recipientCount: number
  readonly deliveryIds: string[]
  readonly status: 'sent' | 'failed' | 'no_recipients'
}

/** Queue adapter for retry on failure (graceful degradation) */
export interface RetryQueueAdapter {
  add(name: string, data: unknown, opts?: Record<string, unknown>): Promise<{ id: string }>
}

/** App user lookup for push opt-in check */
export interface AppUserOptInLookup {
  findById(tenantId: string, id: string): Promise<{ pushOptIn: boolean } | undefined>
}

export interface PushDispatchDeps {
  deviceRepo: DeviceRepository
  deliveryRepo: DeliveryRepository
  pushProvider: PushProvider
  notificationRepo: NotificationLookup
  tenantRepo?: TenantLookup
  retryQueue?: RetryQueueAdapter
  auditLog?: AuditLogger
  appUserLookup?: AppUserOptInLookup
}

/**
 * Orchestrates push notification dispatch:
 * 1. Fetch notification
 * 2. Get active devices for target users
 * 3. Create delivery records (pending)
 * 4. Send via push provider (OneSignal)
 * 5. Update delivery statuses (sent/failed)
 */
export class PushDispatchService {
  private readonly deviceRepo: DeviceRepository
  private readonly deliveryRepo: DeliveryRepository
  private readonly pushProvider: PushProvider
  private readonly notificationRepo: NotificationLookup
  private readonly tenantRepo: TenantLookup | undefined
  private readonly retryQueue: RetryQueueAdapter | undefined
  private readonly auditLog: AuditLogger | undefined
  private readonly appUserLookup: AppUserOptInLookup | undefined

  constructor(deps: PushDispatchDeps) {
    this.deviceRepo = deps.deviceRepo
    this.deliveryRepo = deps.deliveryRepo
    this.pushProvider = deps.pushProvider
    this.notificationRepo = deps.notificationRepo
    this.tenantRepo = deps.tenantRepo
    this.retryQueue = deps.retryQueue
    this.auditLog = deps.auditLog
    this.appUserLookup = deps.appUserLookup
  }

  async dispatch(
    tenantId: string,
    notificationId: string,
    targetUserIds: string[],
    appId?: string,
  ): Promise<PushDispatchResult> {
    // 1. Fetch notification
    const notification = await this.notificationRepo.findById(tenantId, notificationId)
    if (!notification) {
      throw new NotificationNotFoundError(notificationId)
    }

    // 2. Resolve OneSignal app ID
    const resolvedAppId = appId ?? await this.resolveAppId(tenantId)

    // 2.5. Filter out opted-out users (LGPD compliance)
    let eligibleUserIds = targetUserIds
    if (this.appUserLookup) {
      const optInChecks = await Promise.all(
        targetUserIds.map(async (userId) => {
          const user = await this.appUserLookup!.findById(tenantId, userId)
          return { userId, optedIn: user?.pushOptIn !== false }
        }),
      )
      eligibleUserIds = optInChecks.filter((c) => c.optedIn).map((c) => c.userId)
    }

    // 3. Fetch active devices for all target users
    const allDevices: DeviceRow[] = []
    for (const userId of eligibleUserIds) {
      const devices = await this.deviceRepo.findActiveByUser(tenantId, userId)
      allDevices.push(...devices)
    }

    // 4. Zero active devices → no-op
    if (allDevices.length === 0) {
      return {
        notificationId,
        recipientCount: 0,
        deliveryIds: [],
        status: 'no_recipients',
      }
    }

    // 5. Create delivery records (status: pending)
    const deliveryInputs: CreateDeliveryInput[] = allDevices.map((device) => ({
      notificationId,
      deviceId: device.id,
      appUserId: device.appUserId,
    }))

    const deliveries = await this.deliveryRepo.createMany(tenantId, deliveryInputs)
    const deliveryIds = deliveries.map((d) => d.id)

    // 6. Collect device tokens and send via push provider
    const playerIds = allDevices
      .map((d) => d.deviceToken)
      .filter((token): token is string => token !== null && token !== undefined)

    if (playerIds.length === 0) {
      // Devices exist but none have tokens — mark as failed
      await this.deliveryRepo.updateManyStatus(tenantId, deliveryIds, 'failed', new Date())
      return {
        notificationId,
        recipientCount: 0,
        deliveryIds,
        status: 'failed',
      }
    }

    try {
      const payload: PushNotificationPayload = {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl ?? undefined,
        targetUrl: notification.targetUrl ?? undefined,
        data: { ref: `push_${notificationId}` },
        playerIds,
      }

      await this.pushProvider.sendNotification(resolvedAppId, payload)

      // 7. Success: update all deliveries to 'sent'
      const sentAt = new Date()
      await this.deliveryRepo.updateManyStatus(tenantId, deliveryIds, 'sent', sentAt)

      if (this.auditLog) {
        await this.auditLog.log(
          tenantId,
          'push.dispatched',
          'notification',
          notificationId,
          { recipientCount: allDevices.length, deliveryCount: deliveries.length },
        )
      }

      return {
        notificationId,
        recipientCount: allDevices.length,
        deliveryIds,
        status: 'sent',
      }
    } catch {
      // 8. Failure: update all deliveries to 'failed'
      await this.deliveryRepo.updateManyStatus(tenantId, deliveryIds, 'failed', new Date())

      // 9. Queue for retry (graceful degradation)
      if (this.retryQueue) {
        await this.retryQueue.add('push-dispatch-retry', {
          tenantId,
          notificationId,
          targetUserIds,
          appId: resolvedAppId,
        }, {
          delay: 30_000, // 30s backoff
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
        })
      }

      return {
        notificationId,
        recipientCount: allDevices.length,
        deliveryIds,
        status: 'failed',
      }
    }
  }

  private async resolveAppId(tenantId: string): Promise<string> {
    if (this.tenantRepo) {
      const tenant = await this.tenantRepo.findById(tenantId)
      if (tenant?.onesignalAppId) {
        return tenant.onesignalAppId
      }
    }
    return tenantId // fallback
  }
}
