import { auditLog } from '@appfy/db'
import type { PaginationParams } from '@appfy/shared'
import { and, count, desc, eq } from 'drizzle-orm'
import { paginationOffset } from '../common/pagination.js'
import { BaseRepository } from '../repositories/base.repository.js'

export interface AuditLogEntry {
  readonly id: string
  readonly tenantId: string
  readonly userId: string | null
  readonly action: string
  readonly resource: string
  readonly details: Record<string, unknown> | null
  readonly createdAt: Date
}

export interface CreateAuditLogInput {
  action: string
  resource: string
  userId?: string
  details?: Record<string, unknown>
}

export class AuditLogRepository extends BaseRepository {
  async create(tenantId: string, input: CreateAuditLogInput): Promise<AuditLogEntry> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .insert(auditLog)
      .values({
        tenantId,
        action: input.action,
        resource: input.resource,
        userId: input.userId,
        details: input.details,
      })
      .returning()
    return rows[0] as AuditLogEntry
  }

  async list(
    tenantId: string,
    pagination: PaginationParams,
  ): Promise<{ data: AuditLogEntry[]; total: number }> {
    this.assertTenantId(tenantId)
    const offset = paginationOffset(pagination)

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.tenantId, tenantId))
        .orderBy(desc(auditLog.createdAt))
        .limit(pagination.perPage)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(auditLog)
        .where(eq(auditLog.tenantId, tenantId)),
    ])

    return {
      data: data as AuditLogEntry[],
      total: Number(countResult[0]?.total ?? 0),
    }
  }

  async findById(tenantId: string, id: string): Promise<AuditLogEntry | undefined> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.tenantId, tenantId), eq(auditLog.id, id)))
      .limit(1)
    return rows[0] as AuditLogEntry | undefined
  }
}
