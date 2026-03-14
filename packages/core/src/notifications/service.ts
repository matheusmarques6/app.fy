import type { NotificationStatus, PaginatedResponse, PaginationParams } from '@appfy/shared'
import { sanitizeText } from '@appfy/shared'
import { buildPaginatedResponse, normalizePagination } from '../common/pagination.js'
import { DomainError, InvalidStatusTransitionError, NotificationNotFoundError } from '../errors.js'
import type { NotificationRepository } from './repository.js'
import { isValidTransition } from './status-machine.js'
import type { CreateNotificationInput, Notification } from './types.js'

export interface AuditLogger {
  log(
    tenantId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>,
    userId?: string,
  ): Promise<void>
}

export interface NotificationServiceDeps {
  notificationRepo: NotificationRepository
  auditLog?: AuditLogger
}

export class NotificationService {
  private readonly notificationRepo: NotificationRepository
  private readonly auditLog: AuditLogger | undefined

  constructor(deps: NotificationServiceDeps | NotificationRepository) {
    if ('notificationRepo' in deps) {
      this.notificationRepo = deps.notificationRepo
      this.auditLog = deps.auditLog
    } else {
      this.notificationRepo = deps
      this.auditLog = undefined
    }
  }

  async create(tenantId: string, input: CreateNotificationInput): Promise<Notification> {
    // Validate title
    if (!input.title || input.title.trim() === '') {
      throw new DomainError('Notification title is required', 'VALIDATION_ERROR')
    }

    // Sanitize XSS
    const sanitizedInput: CreateNotificationInput = {
      ...input,
      title: sanitizeText(input.title),
      body: sanitizeText(input.body),
    }

    const notification = await this.notificationRepo.create(tenantId, sanitizedInput)

    // Audit log
    if (this.auditLog) {
      await this.auditLog.log(
        tenantId,
        'notification.created',
        'notification',
        notification.id,
        { type: notification.type, title: notification.title },
        input.createdBy,
      )
    }

    return notification
  }

  async getById(tenantId: string, id: string): Promise<Notification> {
    const notification = await this.notificationRepo.findById(tenantId, id)
    if (!notification) {
      throw new NotificationNotFoundError(id)
    }
    return notification
  }

  async list(
    tenantId: string,
    pagination?: Partial<PaginationParams>,
    filters?: { status?: NotificationStatus; type?: string },
  ): Promise<PaginatedResponse<Notification>> {
    const normalized = normalizePagination(pagination)
    const { data, total } = await this.notificationRepo.list(tenantId, normalized, filters)
    return buildPaginatedResponse(data, total, normalized)
  }

  async updateStatus(
    tenantId: string,
    id: string,
    newStatus: NotificationStatus,
    sentAt?: Date,
  ): Promise<Notification> {
    const notification = await this.getById(tenantId, id)

    if (!isValidTransition(notification.status, newStatus)) {
      throw new InvalidStatusTransitionError(notification.status, newStatus)
    }

    const updated = await this.notificationRepo.updateStatus(tenantId, id, newStatus, sentAt)

    if (this.auditLog) {
      await this.auditLog.log(tenantId, 'notification.status_changed', 'notification', id, {
        from: notification.status,
        to: newStatus,
      })
    }

    return updated
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.getById(tenantId, id)
    await this.notificationRepo.delete(tenantId, id)

    if (this.auditLog) {
      await this.auditLog.log(tenantId, 'notification.deleted', 'notification', id)
    }
  }
}
