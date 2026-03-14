import type { DeliveryStatus } from '@appfy/shared'
import { DeliveryNotFoundError } from '../errors.js'
import type { AuditLogger } from './service.js'
import { assertValidDeliveryTransition } from './delivery-status-machine.js'

/** Delivery row with all status timestamps */
export interface DeliveryRecord {
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

/** Timestamp field name for each status — used by repository implementations */
export const STATUS_TIMESTAMP_FIELD: Partial<Record<DeliveryStatus, string>> = {
  sent: 'sentAt',
  delivered: 'deliveredAt',
  opened: 'openedAt',
  clicked: 'clickedAt',
  converted: 'convertedAt',
}

/** Repository interface for delivery status updates with optimistic locking */
export interface DeliveryStatusRepository {
  findById(tenantId: string, id: string): Promise<DeliveryRecord | undefined>
  /** Optimistic lock: UPDATE WHERE id = ? AND status = ? RETURNING * */
  updateStatusOptimistic(
    tenantId: string,
    id: string,
    fromStatus: DeliveryStatus,
    toStatus: DeliveryStatus,
    timestamp?: Date,
    errorMessage?: string,
  ): Promise<DeliveryRecord | null>
}

export interface DeliveryStatusServiceDeps {
  deliveryStatusRepo: DeliveryStatusRepository
  auditLog?: AuditLogger
}

/**
 * Manages delivery status transitions with:
 * - Status machine validation (Layer 1)
 * - Optimistic locking (prevents concurrent duplicate processing)
 * - Individual timestamps per status
 */
export class DeliveryStatusService {
  private readonly repo: DeliveryStatusRepository
  private readonly auditLog: AuditLogger | undefined

  constructor(deps: DeliveryStatusServiceDeps) {
    this.repo = deps.deliveryStatusRepo
    this.auditLog = deps.auditLog
  }

  /**
   * Transitions a delivery to a new status.
   * Returns the updated record, or null if another worker already processed it (optimistic lock).
   * Throws on invalid transition or delivery not found.
   */
  async transition(
    tenantId: string,
    deliveryId: string,
    toStatus: DeliveryStatus,
    errorMessage?: string,
  ): Promise<DeliveryRecord | null> {
    const delivery = await this.repo.findById(tenantId, deliveryId)
    if (!delivery) {
      throw new DeliveryNotFoundError(deliveryId)
    }

    // Validate transition (throws on invalid)
    assertValidDeliveryTransition(delivery.status, toStatus)

    // Determine timestamp
    const timestamp = new Date()

    // Optimistic lock: only update if still in expected status
    const updated = await this.repo.updateStatusOptimistic(
      tenantId,
      deliveryId,
      delivery.status,
      toStatus,
      timestamp,
      errorMessage,
    )

    // null = another worker already processed (race condition)
    if (!updated) {
      return null
    }

    if (this.auditLog) {
      await this.auditLog.log(
        tenantId,
        'delivery.status_changed',
        'delivery',
        deliveryId,
        {
          from: delivery.status,
          to: toStatus,
          notificationId: delivery.notificationId,
          ...(errorMessage ? { errorMessage } : {}),
        },
      )
    }

    return updated
  }
}
