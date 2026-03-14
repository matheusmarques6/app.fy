import type { DeviceRow, RegisterDeviceInput } from '@appfy/core'
import type { DevicePlatform } from '@appfy/shared'
import { DeviceBuilder } from '../builders/device.builder.js'
import { SpyBase } from './spy-base.js'

/** Mirrors {@link DeviceRepository} from @appfy/core (concrete class, not interface) */
export class DeviceRepositorySpy extends SpyBase {
  result: DeviceRow | undefined = undefined
  listResult: DeviceRow[] = []

  async findById(tenantId: string, id: string): Promise<DeviceRow | undefined> {
    this.trackCall('findById', [tenantId, id])
    return this.result
  }

  async findActiveByUser(tenantId: string, appUserId: string): Promise<DeviceRow[]> {
    this.trackCall('findActiveByUser', [tenantId, appUserId])
    return this.listResult
  }

  async findByTokenAndPlatform(
    tenantId: string,
    appUserId: string,
    platform: DevicePlatform,
  ): Promise<DeviceRow[]> {
    this.trackCall('findByTokenAndPlatform', [tenantId, appUserId, platform])
    return this.listResult.filter((d) => d.platform === platform && d.appUserId === appUserId)
  }

  async register(tenantId: string, input: RegisterDeviceInput): Promise<DeviceRow> {
    this.trackCall('register', [tenantId, input])
    return (
      this.result ??
      new DeviceBuilder()
        .withTenant(tenantId)
        .withUser(input.appUserId)
        .withPlatform(input.platform)
        .withToken(input.deviceToken ?? `token-${crypto.randomUUID().slice(0, 8)}`)
        .build()
    )
  }

  async deactivate(tenantId: string, id: string): Promise<void> {
    this.trackCall('deactivate', [tenantId, id])
  }

  async deactivateByUserAndPlatform(
    tenantId: string,
    appUserId: string,
    platform: DevicePlatform,
  ): Promise<void> {
    this.trackCall('deactivateByUserAndPlatform', [tenantId, appUserId, platform])
  }

  async updateLastSeen(tenantId: string, id: string): Promise<void> {
    this.trackCall('updateLastSeen', [tenantId, id])
  }

  async countByUser(tenantId: string, appUserId: string): Promise<number> {
    this.trackCall('countByUser', [tenantId, appUserId])
    return this.listResult.filter((d) => d.appUserId === appUserId).length
  }
}
