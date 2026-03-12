import type { NotificationStatus, PaginationParams } from '@appfy/shared'
import { BaseRepository } from '../repositories/base.repository.js'
import type { CreateNotificationInput, Notification } from './types.js'

export class NotificationRepository extends BaseRepository {
  async create(tenantId: string, _input: CreateNotificationInput): Promise<Notification> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async findById(tenantId: string, _id: string): Promise<Notification | undefined> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async list(
    tenantId: string,
    _pagination: PaginationParams,
  ): Promise<{ data: Notification[]; total: number }> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async updateStatus(
    tenantId: string,
    _id: string,
    _status: NotificationStatus,
    _sentAt?: Date,
  ): Promise<Notification> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }
}
