import { describe, expect, it } from 'vitest'
import {
  AppEventBuilder,
  AppUserBuilder,
  AutomationConfigBuilder,
  DeliveryBuilder,
  DeviceBuilder,
  MembershipBuilder,
  NotificationBuilder,
  TenantBuilder,
  UserBuilder,
} from '../index.js'

describe('Builders: valid data with zero .with*() calls', () => {
  it('TenantBuilder produces valid data', () => {
    const tenant = new TenantBuilder().build()
    expect(tenant.id).toBeDefined()
    expect(tenant.name).toBe('Test Tenant')
    expect(tenant.slug).toMatch(/^tenant-/)
    expect(tenant.platform).toBe('shopify')
    expect(tenant.isActive).toBe(true)
  })

  it('UserBuilder produces valid data', () => {
    const user = new UserBuilder().build()
    expect(user.id).toBeDefined()
    expect(user.email).toMatch(/@test\.com$/)
    expect(user.name).toBe('Test User')
  })

  it('MembershipBuilder produces valid data', () => {
    const membership = new MembershipBuilder().build()
    expect(membership.id).toBeDefined()
    expect(membership.userId).toBeDefined()
    expect(membership.tenantId).toBeDefined()
    expect(membership.tenantId).not.toBe('')
    expect(membership.role).toBe('editor')
  })

  it('AppUserBuilder produces valid data', () => {
    const appUser = new AppUserBuilder().build()
    expect(appUser.id).toBeDefined()
    expect(appUser.tenantId).toBeDefined()
    expect(appUser.tenantId).not.toBe('')
    expect(appUser.pushOptIn).toBe(true)
  })

  it('DeviceBuilder produces valid data', () => {
    const device = new DeviceBuilder().build()
    expect(device.id).toBeDefined()
    expect(device.tenantId).toBeDefined()
    expect(device.tenantId).not.toBe('')
    expect(device.appUserId).toBeDefined()
    expect(device.appUserId).not.toBe('')
    expect(device.platform).toBe('android')
    expect(device.isActive).toBe(true)
  })

  it('NotificationBuilder produces valid data', () => {
    const notification = new NotificationBuilder().build()
    expect(notification.id).toBeDefined()
    expect(notification.tenantId).toBeDefined()
    expect(notification.tenantId).not.toBe('')
    expect(notification.title).toBe('Test Notification')
    expect(notification.status).toBe('draft')
    expect(notification.type).toBe('manual')
  })

  it('DeliveryBuilder produces valid data', () => {
    const delivery = new DeliveryBuilder().build()
    expect(delivery.id).toBeDefined()
    expect(delivery.tenantId).toBeDefined()
    expect(delivery.tenantId).not.toBe('')
    expect(delivery.notificationId).toBeDefined()
    expect(delivery.deviceId).toBeDefined()
    expect(delivery.status).toBe('pending')
  })

  it('AutomationConfigBuilder produces valid data', () => {
    const config = new AutomationConfigBuilder().build()
    expect(config.id).toBeDefined()
    expect(config.tenantId).toBeDefined()
    expect(config.tenantId).not.toBe('')
    expect(config.flowType).toBe('cart_abandoned')
    expect(config.isEnabled).toBe(true)
    expect(config.delaySeconds).toBe(3600)
  })

  it('AppEventBuilder produces valid data', () => {
    const event = new AppEventBuilder().build()
    expect(event.id).toBeDefined()
    expect(event.tenantId).toBeDefined()
    expect(event.tenantId).not.toBe('')
    expect(event.eventType).toBe('app_opened')
  })
})

describe('Builders: unique IDs per build', () => {
  it('each build() returns a different ID', () => {
    const uniqueIds = new Set(
      Array.from({ length: 10 }, () => new NotificationBuilder().build().id),
    )
    expect(uniqueIds.size).toBe(10)
  })

  it('TenantBuilder generates unique slugs', () => {
    const slugs = new Set(
      Array.from({ length: 10 }, () => new TenantBuilder().build().slug),
    )
    expect(slugs.size).toBe(10)
  })
})

describe('Builders: .with*() overrides', () => {
  it('NotificationBuilder.withTenant() sets tenantId', () => {
    const tenantId = 'custom-tenant-id'
    const notification = new NotificationBuilder().withTenant(tenantId).build()
    expect(notification.tenantId).toBe(tenantId)
  })

  it('NotificationBuilder.withTitle() sets title', () => {
    const notification = new NotificationBuilder().withTitle('Custom Title').build()
    expect(notification.title).toBe('Custom Title')
  })

  it('NotificationBuilder.automated() sets type and flowType', () => {
    const notification = new NotificationBuilder().automated('cart_abandoned').build()
    expect(notification.type).toBe('automated')
    expect(notification.flowType).toBe('cart_abandoned')
  })

  it('DeviceBuilder.ios() sets platform', () => {
    const device = new DeviceBuilder().ios().build()
    expect(device.platform).toBe('ios')
  })

  it('DeviceBuilder.inactive() sets isActive false', () => {
    const device = new DeviceBuilder().inactive().build()
    expect(device.isActive).toBe(false)
  })

  it('AppUserBuilder.highValue() sets purchase data', () => {
    const user = new AppUserBuilder().highValue().build()
    expect(user.totalPurchases).toBe(10)
    expect(user.totalSpent).toBe(5000)
  })

  it('AppUserBuilder.optedOut() sets pushOptIn false', () => {
    const user = new AppUserBuilder().optedOut().build()
    expect(user.pushOptIn).toBe(false)
  })

  it('AutomationConfigBuilder.disabled() sets isEnabled false', () => {
    const config = new AutomationConfigBuilder().disabled().build()
    expect(config.isEnabled).toBe(false)
  })

  it('DeliveryBuilder.sent() sets status and sentAt', () => {
    const delivery = new DeliveryBuilder().sent().build()
    expect(delivery.status).toBe('sent')
    expect(delivery.sentAt).toBeInstanceOf(Date)
  })

  it('MembershipBuilder.owner() sets role', () => {
    const membership = new MembershipBuilder().owner().build()
    expect(membership.role).toBe('owner')
  })
})

describe('Builders: fluent API (chaining)', () => {
  it('NotificationBuilder methods return this', () => {
    const builder = new NotificationBuilder()
    expect(builder.withTenant('t')).toBe(builder)
    expect(builder.withTitle('x')).toBe(builder)
    expect(builder.withBody('y')).toBe(builder)
    expect(builder.manual()).toBe(builder)
  })

  it('DeviceBuilder methods return this', () => {
    const builder = new DeviceBuilder()
    expect(builder.withTenant('t')).toBe(builder)
    expect(builder.withUser('u')).toBe(builder)
    expect(builder.android()).toBe(builder)
    expect(builder.active()).toBe(builder)
  })
})
