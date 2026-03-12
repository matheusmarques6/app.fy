import type { NotificationStatus, PaginatedResponse, PaginationParams } from '@appfy/shared'
import { buildPaginatedResponse, normalizePagination } from '../common/pagination.js'
import { InvalidStatusTransitionError, NotificationNotFoundError } from '../errors.js'
import type { NotificationRepository } from './repository.js'
import type { CreateNotificationInput, Notification } from './types.js'

/** Valid status transitions */
const validTransitions: Record<string, NotificationStatus[]> = {
  draft: ['approved'],
  approved: ['scheduled', 'sending'],
  scheduled: ['sending'],
  sending: ['sent', 'failed'],
  sent: [],
  failed: ['approved'],
}

export class NotificationService {
  constructor(private readonly notificationRepo: NotificationRepository) {}

  async create(tenantId: string, input: CreateNotificationInput): Promise<Notification> {
    return this.notificationRepo.create(tenantId, input)
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
  ): Promise<PaginatedResponse<Notification>> {
    const normalized = normalizePagination(pagination)
    const { data, total } = await this.notificationRepo.list(tenantId, normalized)
    return buildPaginatedResponse(data, total, normalized)
  }

  async updateStatus(
    tenantId: string,
    id: string,
    newStatus: NotificationStatus,
    sentAt?: Date,
  ): Promise<Notification> {
    const notification = await this.getById(tenantId, id)
    const allowed = validTransitions[notification.status] ?? []
    if (!allowed.includes(newStatus)) {
      throw new InvalidStatusTransitionError(notification.status, newStatus)
    }
    return this.notificationRepo.updateStatus(tenantId, id, newStatus, sentAt)
  }

  async dispatch(tenantId: string, id: string): Promise<void> {
    await this.updateStatus(tenantId, id, 'sending')
    // Actual dispatch delegates to pipeline via queue — stub for now
  }
}
