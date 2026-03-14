import { devices } from '@appfy/db'
import type { DevicePlatform } from '@appfy/shared'
import { and, count, eq } from 'drizzle-orm'
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
  async findById(tenantId: string, id: string): Promise<DeviceRow | undefined> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select()
      .from(devices)
      .where(and(eq(devices.tenantId, tenantId), eq(devices.id, id)))
      .limit(1)
    return rows[0] as DeviceRow | undefined
  }

  async findActiveByUser(tenantId: string, appUserId: string): Promise<DeviceRow[]> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.tenantId, tenantId),
          eq(devices.appUserId, appUserId),
          eq(devices.isActive, true),
        ),
      )
    return rows as DeviceRow[]
  }

  async findByTokenAndPlatform(
    tenantId: string,
    appUserId: string,
    platform: DevicePlatform,
  ): Promise<DeviceRow[]> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.tenantId, tenantId),
          eq(devices.appUserId, appUserId),
          eq(devices.platform, platform),
        ),
      )
    return rows as DeviceRow[]
  }

  async register(tenantId: string, input: RegisterDeviceInput): Promise<DeviceRow> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .insert(devices)
      .values({
        tenantId,
        appUserId: input.appUserId,
        deviceToken: input.deviceToken,
        platform: input.platform,
        osVersion: input.osVersion,
        appVersion: input.appVersion,
      })
      .returning()
    return rows[0] as DeviceRow
  }

  async deactivate(tenantId: string, id: string): Promise<void> {
    this.assertTenantId(tenantId)
    await this.db
      .update(devices)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(devices.tenantId, tenantId), eq(devices.id, id)))
  }

  async deactivateByUserAndPlatform(
    tenantId: string,
    appUserId: string,
    platform: DevicePlatform,
  ): Promise<void> {
    this.assertTenantId(tenantId)
    await this.db
      .update(devices)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(devices.tenantId, tenantId),
          eq(devices.appUserId, appUserId),
          eq(devices.platform, platform),
        ),
      )
  }

  async updateLastSeen(tenantId: string, id: string): Promise<void> {
    this.assertTenantId(tenantId)
    await this.db
      .update(devices)
      .set({ lastSeenAt: new Date(), updatedAt: new Date() })
      .where(and(eq(devices.tenantId, tenantId), eq(devices.id, id)))
  }

  /**
   * Delete all devices for a specific app user (LGPD data deletion).
   * @returns number of deleted rows
   */
  async deleteByAppUser(tenantId: string, appUserId: string): Promise<number> {
    this.assertTenantId(tenantId)
    const deleted = await this.db
      .delete(devices)
      .where(and(eq(devices.tenantId, tenantId), eq(devices.appUserId, appUserId)))
      .returning()
    return deleted.length
  }

  async countByUser(tenantId: string, appUserId: string): Promise<number> {
    this.assertTenantId(tenantId)
    const result = await this.db
      .select({ total: count() })
      .from(devices)
      .where(and(eq(devices.tenantId, tenantId), eq(devices.appUserId, appUserId)))
    return Number(result[0]?.total ?? 0)
  }
}
