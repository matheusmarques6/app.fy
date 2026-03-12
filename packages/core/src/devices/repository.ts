import type { DevicePlatform } from '@appfy/shared'
import { BaseRepository } from '../repositories/base.repository.js'

export interface DeviceRow {
  readonly id: string
  readonly tenantId: string
  readonly appUserId: string
  readonly deviceToken: string | null
  readonly platform: DevicePlatform
  readonly osVersion: string | null
  readonly appVersion: string | null
  readonly isActive: boolean
  readonly lastSeenAt: Date | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface RegisterDeviceInput {
  readonly appUserId: string
  readonly deviceToken?: string
  readonly platform: DevicePlatform
  readonly osVersion?: string
  readonly appVersion?: string
}

export class DeviceRepository extends BaseRepository {
  async findById(tenantId: string, _id: string): Promise<DeviceRow | undefined> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async findActiveByUser(tenantId: string, _appUserId: string): Promise<DeviceRow[]> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async register(tenantId: string, _input: RegisterDeviceInput): Promise<DeviceRow> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async deactivate(tenantId: string, _id: string): Promise<void> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async updateLastSeen(tenantId: string, _id: string): Promise<void> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }
}
