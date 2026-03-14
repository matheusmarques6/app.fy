import { notificationDeliveries } from '@appfy/db'
import type { DeliveryStatus } from '@appfy/shared'
import { and, eq, inArray } from 'drizzle-orm'
import { BaseRepository } from '../repositories/base.repository.js'
import type { CreateDeliveryInput, DeliveryRepository, DeliveryRow } from '../push/push-dispatch.service.js'
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
      .where(
        and(
          eq(notificationDeliveries.tenantId, tenantId),
          eq(notificationDeliveries.id, id),
        ),
      )
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
        and(
          eq(notificationDeliveries.tenantId, tenantId),
          inArray(notificationDeliveries.id, ids),
        ),
      )
  }

  // --- DeliveryStatusRepository (optimistic locking) ---

  async findById(tenantId: string, id: string): Promise<DeliveryRecord | undefined> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select()
      .from(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.tenantId, tenantId),
          eq(notificationDeliveries.id, id),
        ),
      )
      .limit(1)
    return rows[0] as DeliveryRecord | undefined
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
