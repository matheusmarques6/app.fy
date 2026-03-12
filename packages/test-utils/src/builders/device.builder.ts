import type { DeviceRow } from '@appfy/core'
import type { DevicePlatform } from '@appfy/shared'

export class DeviceBuilder {
  private data: DeviceRow = {
    id: crypto.randomUUID(),
    tenantId: '',
    appUserId: '',
    deviceToken: `token-${crypto.randomUUID().slice(0, 8)}`,
    platform: 'android',
    osVersion: null,
    appVersion: null,
    isActive: true,
    lastSeenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  withId(id: string): this {
    this.data = { ...this.data, id }
    return this
  }

  withTenant(tenantId: string): this {
    this.data = { ...this.data, tenantId }
    return this
  }

  withUser(appUserId: string): this {
    this.data = { ...this.data, appUserId }
    return this
  }

  withToken(token: string): this {
    this.data = { ...this.data, deviceToken: token }
    return this
  }

  withPlatform(platform: DevicePlatform): this {
    this.data = { ...this.data, platform }
    return this
  }

  android(): this {
    return this.withPlatform('android')
  }

  ios(): this {
    return this.withPlatform('ios')
  }

  active(): this {
    this.data = { ...this.data, isActive: true }
    return this
  }

  inactive(): this {
    this.data = { ...this.data, isActive: false }
    return this
  }

  withOsVersion(version: string): this {
    this.data = { ...this.data, osVersion: version }
    return this
  }

  withAppVersion(version: string): this {
    this.data = { ...this.data, appVersion: version }
    return this
  }

  build(): DeviceRow {
    if (!this.data.tenantId) {
      throw new Error('DeviceBuilder: tenantId is required. Use .withTenant()')
    }
    if (!this.data.appUserId) {
      throw new Error('DeviceBuilder: appUserId is required. Use .withUser()')
    }
    return { ...this.data }
  }
}
