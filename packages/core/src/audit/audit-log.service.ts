import type { AuditLogger } from '../notifications/service.js'
import type { AuditLogRepository, AuditLogEntry, CreateAuditLogInput } from './audit-log.repository.js'
import type { PaginationParams } from '@appfy/shared'
import type { PaginatedResponse } from '@appfy/shared'
import { buildPaginatedResponse, normalizePagination } from '../common/pagination.js'

/**
 * Audit Log Service — append-only log for tracking actions.
 * No update or delete methods exposed (append-only design).
 * Implements AuditLogger interface for use by other services.
 */
export class AuditLogService implements AuditLogger {
  constructor(private readonly repo: AuditLogRepository) {}

  /**
   * Log an action. Implements the AuditLogger interface used by NotificationService etc.
   * Fire-and-forget safe — errors are swallowed to avoid breaking business flows.
   */
  async log(
    tenantId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>,
    userId?: string,
  ): Promise<void> {
    const input: CreateAuditLogInput = {
      action,
      resource: `${entityType}:${entityId}`,
      ...(userId !== undefined && { userId }),
      ...(metadata !== undefined && { details: metadata }),
    }

    await this.repo.create(tenantId, input)
  }

  async list(
    tenantId: string,
    pagination?: Partial<PaginationParams>,
  ): Promise<PaginatedResponse<AuditLogEntry>> {
    const normalized = normalizePagination(pagination)
    const { data, total } = await this.repo.list(tenantId, normalized)
    return buildPaginatedResponse(data, total, normalized)
  }

  async getById(tenantId: string, id: string): Promise<AuditLogEntry | undefined> {
    return this.repo.findById(tenantId, id)
  }
}
