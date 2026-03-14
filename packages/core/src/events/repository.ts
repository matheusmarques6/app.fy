import { appEvents } from '@appfy/db'
import type { Database } from '@appfy/db'
import { and, count, desc, eq, gt, inArray, lt } from 'drizzle-orm'
import { BaseRepository } from '../repositories/base.repository.js'
import type { AppEventRow, CreateEventInput, EventFilters } from './types.js'

/**
 * Repository for app_events table.
 * tenantId is mandatory on every operation (multi-tenant isolation).
 */
export class EventRepository extends BaseRepository {
  constructor(db: Database) {
    super(db)
  }

  async create(tenantId: string, input: CreateEventInput): Promise<AppEventRow> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .insert(appEvents)
      .values({
        tenantId,
        appUserId: input.appUserId,
        eventType: input.eventType,
        properties: input.properties,
      })
      .returning()
    return rows[0] as AppEventRow
  }

  async findById(tenantId: string, id: string): Promise<AppEventRow | undefined> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select()
      .from(appEvents)
      .where(and(eq(appEvents.tenantId, tenantId), eq(appEvents.id, id)))
      .limit(1)
    return rows[0] as AppEventRow | undefined
  }

  async findRecent(
    tenantId: string,
    appUserId: string,
    eventType: string,
    withinSeconds: number,
  ): Promise<AppEventRow[]> {
    this.assertTenantId(tenantId)
    const cutoff = new Date(Date.now() - withinSeconds * 1000)
    const rows = await this.db
      .select()
      .from(appEvents)
      .where(
        and(
          eq(appEvents.tenantId, tenantId),
          eq(appEvents.appUserId, appUserId),
          eq(appEvents.eventType, eventType as AppEventRow['eventType']),
          gt(appEvents.createdAt, cutoff),
        ),
      )
      .orderBy(desc(appEvents.createdAt))
    return rows as AppEventRow[]
  }

  async list(
    tenantId: string,
    filters?: EventFilters,
  ): Promise<{ data: AppEventRow[]; total: number }> {
    this.assertTenantId(tenantId)
    const conditions = [eq(appEvents.tenantId, tenantId)]
    if (filters?.eventType) {
      conditions.push(eq(appEvents.eventType, filters.eventType))
    }
    if (filters?.appUserId) {
      conditions.push(eq(appEvents.appUserId, filters.appUserId))
    }

    const where = and(...conditions)

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(appEvents)
        .where(where)
        .orderBy(desc(appEvents.createdAt)),
      this.db.select({ total: count() }).from(appEvents).where(where),
    ])

    return {
      data: data as AppEventRow[],
      total: Number(countResult[0]?.total ?? 0),
    }
  }

  /**
   * Delete all events for a specific app user (LGPD data deletion).
   * @returns number of deleted rows
   */
  async deleteByAppUser(tenantId: string, appUserId: string): Promise<number> {
    this.assertTenantId(tenantId)
    const deleted = await this.db
      .delete(appEvents)
      .where(and(eq(appEvents.tenantId, tenantId), eq(appEvents.appUserId, appUserId)))
      .returning()
    return deleted.length
  }

  /**
   * Delete events older than the given date (data retention).
   * Uses LIMIT to batch deletions and avoid long locks.
   * Global operation (not per tenant).
   * @returns number of deleted rows in this batch
   */
  async deleteExpiredBefore(date: Date, batchSize: number): Promise<number> {
    // Subquery approach: select IDs to delete, then delete those
    const toDelete = await this.db
      .select({ id: appEvents.id })
      .from(appEvents)
      .where(lt(appEvents.createdAt, date))
      .limit(batchSize)

    if (toDelete.length === 0) return 0

    const ids = toDelete.map((r) => r.id)
    const deleted = await this.db
      .delete(appEvents)
      .where(inArray(appEvents.id, ids))
      .returning()
    return deleted.length
  }

  async count(tenantId: string, filters?: EventFilters): Promise<number> {
    this.assertTenantId(tenantId)
    const conditions = [eq(appEvents.tenantId, tenantId)]
    if (filters?.eventType) {
      conditions.push(eq(appEvents.eventType, filters.eventType))
    }
    if (filters?.appUserId) {
      conditions.push(eq(appEvents.appUserId, filters.appUserId))
    }

    const result = await this.db
      .select({ total: count() })
      .from(appEvents)
      .where(and(...conditions))
    return Number(result[0]?.total ?? 0)
  }
}
