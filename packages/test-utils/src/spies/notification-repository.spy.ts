import type { CreateNotificationInput, Notification } from '@appfy/core'
import type { NotificationStatus, PaginationParams } from '@appfy/shared'
import { NotificationBuilder } from '../builders/notification.builder.js'
import { SpyBase } from './spy-base.js'

/** Mirrors {@link NotificationRepository} from @appfy/core (concrete class, not interface) */
export class NotificationRepositorySpy extends SpyBase {
  result: Notification | undefined = undefined
  listResult: { data: Notification[]; total: number } = { data: [], total: 0 }

  async create(tenantId: string, input: CreateNotificationInput): Promise<Notification> {
    this.trackCall('create', [tenantId, input])
    return (
      this.result ??
      new NotificationBuilder()
        .withTenant(tenantId)
        .withTitle(input.title)
        .withBody(input.body)
        .build()
    )
  }

  async findById(tenantId: string, id: string): Promise<Notification | undefined> {
    this.trackCall('findById', [tenantId, id])
    return this.result
  }

  async list(
    tenantId: string,
    pagination: PaginationParams,
  ): Promise<{ data: Notification[]; total: number }> {
    this.trackCall('list', [tenantId, pagination])
    return this.listResult
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: NotificationStatus,
    sentAt?: Date,
  ): Promise<Notification> {
    this.trackCall('updateStatus', [tenantId, id, status, sentAt])
    return this.result ?? new NotificationBuilder().withTenant(tenantId).withStatus(status).build()
  }
}
