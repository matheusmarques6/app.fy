import type { DeviceRow, RegisterDeviceInput } from '@appfy/core'
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

  async register(tenantId: string, input: RegisterDeviceInput): Promise<DeviceRow> {
    this.trackCall('register', [tenantId, input])
    return (
      this.result ??
      new DeviceBuilder()
        .withTenant(tenantId)
        .withUser(input.appUserId)
        .withPlatform(input.platform)
        .build()
    )
  }

  async deactivate(tenantId: string, id: string): Promise<void> {
    this.trackCall('deactivate', [tenantId, id])
  }

  async updateLastSeen(tenantId: string, id: string): Promise<void> {
    this.trackCall('updateLastSeen', [tenantId, id])
  }
}
