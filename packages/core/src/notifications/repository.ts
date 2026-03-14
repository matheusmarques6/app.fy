import { notifications } from '@appfy/db'
import type { NotificationStatus, PaginationParams } from '@appfy/shared'
import { and, count, desc, eq } from 'drizzle-orm'
import { paginationOffset } from '../common/pagination.js'
import { BaseRepository } from '../repositories/base.repository.js'
import type { CreateNotificationInput, Notification } from './types.js'

export class NotificationRepository extends BaseRepository {
  async create(tenantId: string, input: CreateNotificationInput): Promise<Notification> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .insert(notifications)
      .values({
        tenantId,
        type: input.type,
        flowType: input.flowType,
        title: input.title,
        body: input.body,
        imageUrl: input.imageUrl,
        targetUrl: input.targetUrl,
        segmentRules: input.segmentRules,
        scheduledAt: input.scheduledAt,
        createdBy: input.createdBy,
        abVariant: input.abVariant,
        abConfig: input.abConfig,
      })
      .returning()
    return rows[0] as unknown as Notification
  }

  async findById(tenantId: string, id: string): Promise<Notification | undefined> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.tenantId, tenantId), eq(notifications.id, id)))
      .limit(1)
    return rows[0] as unknown as Notification | undefined
  }

  async list(
    tenantId: string,
    pagination: PaginationParams,
    filters?: { status?: NotificationStatus; type?: string },
  ): Promise<{ data: Notification[]; total: number }> {
    this.assertTenantId(tenantId)
    const offset = paginationOffset(pagination)

    const conditions = [eq(notifications.tenantId, tenantId)]
    if (filters?.status) {
      conditions.push(eq(notifications.status, filters.status))
    }
    if (filters?.type) {
      conditions.push(eq(notifications.type, filters.type as 'manual' | 'automated'))
    }

    const where = and(...conditions)

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(pagination.perPage)
        .offset(offset),
      this.db.select({ total: count() }).from(notifications).where(where),
    ])

    return {
      data: data as unknown as Notification[],
      total: Number(countResult[0]?.total ?? 0),
    }
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: NotificationStatus,
    sentAt?: Date,
  ): Promise<Notification> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .update(notifications)
      .set({
        status,
        ...(sentAt !== undefined && { sentAt }),
        updatedAt: new Date(),
      })
      .where(and(eq(notifications.tenantId, tenantId), eq(notifications.id, id)))
      .returning()
    return rows[0] as unknown as Notification
  }

  async delete(tenantId: string, id: string): Promise<void> {
    this.assertTenantId(tenantId)
    await this.db
      .delete(notifications)
      .where(and(eq(notifications.tenantId, tenantId), eq(notifications.id, id)))
  }

  async count(
    tenantId: string,
    filters?: { status?: NotificationStatus; type?: string },
  ): Promise<number> {
    this.assertTenantId(tenantId)
    const conditions = [eq(notifications.tenantId, tenantId)]
    if (filters?.status) {
      conditions.push(eq(notifications.status, filters.status))
    }
    if (filters?.type) {
      conditions.push(eq(notifications.type, filters.type as 'manual' | 'automated'))
    }

    const result = await this.db
      .select({ total: count() })
      .from(notifications)
      .where(and(...conditions))
    return Number(result[0]?.total ?? 0)
  }
}
