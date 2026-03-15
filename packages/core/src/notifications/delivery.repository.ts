import { devices, notificationDeliveries } from '@appfy/db'
import type { DeliveryStatus } from '@appfy/shared'
import { and, eq, inArray, lt } from 'drizzle-orm'
import { BaseRepository } from '../repositories/base.repository.js'
import type {
  CreateDeliveryInput,
  DeliveryRepository,
  DeliveryRow,
} from '../push/push-dispatch.service.js'
import type { DeliveryRecord, DeliveryStatusRepository } from './delivery-status.service.js'

/**
 * Status → timestamp column mapping.
 * When updating to a given status, we set the corresponding timestamp.
 */
const STATUS_TIMESTAMP_MAP: Record<string, string> = {
  sent: 'sentAt',
  delivered: 'deliveredAt',
  opened: 'openedAt',
  clicked: 'clickedAt',
  converted: 'convertedAt',
}

/**
 * Drizzle implementation of DeliveryRepository + DeliveryStatusRepository.
 * Manages notification_deliveries table.
 *
 * - DeliveryRepository: batch operations for push dispatch (no optimistic locking)
 * - DeliveryStatusRepository: individual transitions with optimistic locking
 */
export class DrizzleDeliveryRepository
  extends BaseRepository
  implements DeliveryRepository, DeliveryStatusRepository
{
  async create(
    tenantId: string,
    notificationId: string,
    deviceId: string,
    appUserId?: string,
  ): Promise<DeliveryRow> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .insert(notificationDeliveries)
      .values({
        tenantId,
        notificationId,
        deviceId,
        appUserId: appUserId ?? null,
      })
      .returning()
    return rows[0] as DeliveryRow
  }

  async createMany(tenantId: string, records: CreateDeliveryInput[]): Promise<DeliveryRow[]> {
    this.assertTenantId(tenantId)
    if (records.length === 0) return []

    const values = records.map((r) => ({
      tenantId,
      notificationId: r.notificationId,
      deviceId: r.deviceId,
      appUserId: r.appUserId ?? null,
    }))

    const rows = await this.db.insert(notificationDeliveries).values(values).returning()
    return rows as DeliveryRow[]
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: DeliveryStatus,
    timestamp?: Date,
  ): Promise<void> {
    this.assertTenantId(tenantId)
    const ts = timestamp ?? new Date()
    const tsField = STATUS_TIMESTAMP_MAP[status]

    await this.db
      .update(notificationDeliveries)
      .set({
        status,
        ...(tsField && { [tsField]: ts }),
        updatedAt: ts,
      })
      .where(and(eq(notificationDeliveries.tenantId, tenantId), eq(notificationDeliveries.id, id)))
  }

  async updateManyStatus(
    tenantId: string,
    ids: string[],
    status: DeliveryStatus,
    timestamp?: Date,
  ): Promise<void> {
    this.assertTenantId(tenantId)
    if (ids.length === 0) return

    const ts = timestamp ?? new Date()
    const tsField = STATUS_TIMESTAMP_MAP[status]

    await this.db
      .update(notificationDeliveries)
      .set({
        status,
        ...(tsField && { [tsField]: ts }),
        updatedAt: ts,
      })
      .where(
        and(eq(notificationDeliveries.tenantId, tenantId), inArray(notificationDeliveries.id, ids)),
      )
  }

  async findPendingByNotification(
    tenantId: string,
    notificationId: string,
  ): Promise<DeliveryRow[]> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select()
      .from(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.tenantId, tenantId),
          eq(notificationDeliveries.notificationId, notificationId),
          eq(notificationDeliveries.status, 'pending'),
        ),
      )
    return rows as DeliveryRow[]
  }

  async updateManyExternalId(tenantId: string, ids: string[], externalId: string): Promise<void> {
    this.assertTenantId(tenantId)
    if (ids.length === 0) return

    await this.db
      .update(notificationDeliveries)
      .set({
        externalId,
        updatedAt: new Date(),
      })
      .where(
        and(eq(notificationDeliveries.tenantId, tenantId), inArray(notificationDeliveries.id, ids)),
      )
  }

  async findPendingByNotificationAndTokens(
    tenantId: string,
    notificationId: string,
    deviceTokens: string[],
  ): Promise<DeliveryRow[]> {
    this.assertTenantId(tenantId)
    if (deviceTokens.length === 0) return []

    const rows = await this.db
      .select({
        id: notificationDeliveries.id,
        tenantId: notificationDeliveries.tenantId,
        notificationId: notificationDeliveries.notificationId,
        deviceId: notificationDeliveries.deviceId,
        appUserId: notificationDeliveries.appUserId,
        status: notificationDeliveries.status,
        sentAt: notificationDeliveries.sentAt,
        deliveredAt: notificationDeliveries.deliveredAt,
        openedAt: notificationDeliveries.openedAt,
        clickedAt: notificationDeliveries.clickedAt,
        convertedAt: notificationDeliveries.convertedAt,
        externalId: notificationDeliveries.externalId,
        errorMessage: notificationDeliveries.errorMessage,
        createdAt: notificationDeliveries.createdAt,
        updatedAt: notificationDeliveries.updatedAt,
      })
      .from(notificationDeliveries)
      .innerJoin(devices, eq(notificationDeliveries.deviceId, devices.id))
      .where(
        and(
          eq(notificationDeliveries.tenantId, tenantId),
          eq(notificationDeliveries.notificationId, notificationId),
          eq(notificationDeliveries.status, 'pending'),
          inArray(devices.deviceToken, deviceTokens),
        ),
      )
    return rows as DeliveryRow[]
  }

  /**
   * Atomic update: sets status to 'sent', sentAt, AND externalId in a single UPDATE.
   * Avoids the race condition of two separate calls (updateManyStatus + updateManyExternalId).
   */
  async updateManySent(
    tenantId: string,
    ids: string[],
    externalId: string,
    sentAt: Date,
  ): Promise<void> {
    this.assertTenantId(tenantId)
    if (ids.length === 0) return

    await this.db
      .update(notificationDeliveries)
      .set({
        status: 'sent' as DeliveryStatus,
        sentAt,
        externalId,
        updatedAt: sentAt,
      })
      .where(
        and(eq(notificationDeliveries.tenantId, tenantId), inArray(notificationDeliveries.id, ids)),
      )
  }

  // --- DeliveryStatusRepository (optimistic locking) ---

  async findById(tenantId: string, id: string): Promise<DeliveryRecord | undefined> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select()
      .from(notificationDeliveries)
      .where(and(eq(notificationDeliveries.tenantId, tenantId), eq(notificationDeliveries.id, id)))
      .limit(1)
    return rows[0] as DeliveryRecord | undefined
  }

  /**
   * Anonymize all deliveries for a specific app user (LGPD: set app_user_id = null).
   * Preserves delivery records for metrics — does NOT delete.
   * @returns number of anonymized rows
   */
  async anonymizeByAppUser(tenantId: string, appUserId: string): Promise<number> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .update(notificationDeliveries)
      .set({ appUserId: null, updatedAt: new Date() })
      .where(
        and(
          eq(notificationDeliveries.tenantId, tenantId),
          eq(notificationDeliveries.appUserId, appUserId),
        ),
      )
      .returning()
    return rows.length
  }

  /**
   * Delete deliveries older than the given date (data retention).
   * Batch-limited to avoid long locks. Global operation (not per tenant).
   * @returns number of deleted rows in this batch
   */
  async deleteExpiredBefore(date: Date, batchSize: number): Promise<number> {
    // Select IDs to delete first, then delete those (batch approach)
    const toDelete = await this.db
      .select({ id: notificationDeliveries.id })
      .from(notificationDeliveries)
      .where(lt(notificationDeliveries.createdAt, date))
      .limit(batchSize)

    if (toDelete.length === 0) return 0

    const ids = toDelete.map((r) => r.id)
    const deleted = await this.db
      .delete(notificationDeliveries)
      .where(inArray(notificationDeliveries.id, ids))
      .returning()
    return deleted.length
  }

  /**
   * Optimistic lock: UPDATE WHERE id = ? AND status = fromStatus RETURNING *.
   * Returns null if another worker already transitioned this delivery (0 rows updated).
   */
  async updateStatusOptimistic(
    tenantId: string,
    id: string,
    fromStatus: DeliveryStatus,
    toStatus: DeliveryStatus,
    timestamp?: Date,
    errorMessage?: string,
  ): Promise<DeliveryRecord | null> {
    this.assertTenantId(tenantId)
    const ts = timestamp ?? new Date()
    const tsField = STATUS_TIMESTAMP_MAP[toStatus]

    const rows = await this.db
      .update(notificationDeliveries)
      .set({
        status: toStatus,
        ...(tsField && { [tsField]: ts }),
        ...(errorMessage !== undefined && { errorMessage }),
        updatedAt: ts,
      })
      .where(
        and(
          eq(notificationDeliveries.tenantId, tenantId),
          eq(notificationDeliveries.id, id),
          eq(notificationDeliveries.status, fromStatus),
        ),
      )
      .returning()

    return (rows[0] as DeliveryRecord) ?? null
  }
}
