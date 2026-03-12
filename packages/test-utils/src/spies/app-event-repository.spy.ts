import type { AppEventType } from '@appfy/shared'
import type { AppEventRow } from '../builders/app-event.builder.js'
import { AppEventBuilder } from '../builders/app-event.builder.js'
import { SpyBase } from './spy-base.js'

/** Mirrors app event repository contract from @appfy/core */
export class AppEventRepositorySpy extends SpyBase {
  listResult: AppEventRow[] = []

  async create(
    tenantId: string,
    eventType: AppEventType,
    appUserId?: string,
    deviceId?: string,
    properties?: Record<string, unknown>,
  ): Promise<AppEventRow> {
    this.trackCall('create', [tenantId, eventType, appUserId, deviceId, properties])
    const builder = new AppEventBuilder().withTenant(tenantId)
    if (appUserId) builder.withUser(appUserId)
    if (deviceId) builder.withDevice(deviceId)
    if (properties) builder.withProperties(properties)
    return builder.build()
  }

  async listByTenant(tenantId: string): Promise<AppEventRow[]> {
    this.trackCall('listByTenant', [tenantId])
    return this.listResult
  }

  async listByUser(tenantId: string, appUserId: string): Promise<AppEventRow[]> {
    this.trackCall('listByUser', [tenantId, appUserId])
    return this.listResult.filter((e) => e.appUserId === appUserId)
  }
}
