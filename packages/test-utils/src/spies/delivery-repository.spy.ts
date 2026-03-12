import type { DeliveryStatus } from '@appfy/shared'
import type { DeliveryRow } from '../builders/delivery.builder.js'
import { DeliveryBuilder } from '../builders/delivery.builder.js'
import { SpyBase } from './spy-base.js'

/** Mirrors delivery repository contract from @appfy/core */
export class DeliveryRepositorySpy extends SpyBase {
  result: DeliveryRow | undefined = undefined
  listResult: DeliveryRow[] = []

  async create(tenantId: string, notificationId: string, deviceId: string): Promise<DeliveryRow> {
    this.trackCall('create', [tenantId, notificationId, deviceId])
    return (
      this.result ??
      new DeliveryBuilder()
        .withTenant(tenantId)
        .withNotification(notificationId)
        .withDevice(deviceId)
        .build()
    )
  }

  async findById(tenantId: string, id: string): Promise<DeliveryRow | undefined> {
    this.trackCall('findById', [tenantId, id])
    return this.result
  }

  async updateStatus(tenantId: string, id: string, status: DeliveryStatus): Promise<void> {
    this.trackCall('updateStatus', [tenantId, id, status])
  }

  async listByNotification(tenantId: string, notificationId: string): Promise<DeliveryRow[]> {
    this.trackCall('listByNotification', [tenantId, notificationId])
    return this.listResult
  }

  async listByDevice(tenantId: string, deviceId: string): Promise<DeliveryRow[]> {
    this.trackCall('listByDevice', [tenantId, deviceId])
    return this.listResult
  }
}
