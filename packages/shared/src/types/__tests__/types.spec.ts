import { describe, expect, it } from 'vitest'

import type { AppConfig } from '../app-config.js'
import type { AppEvent } from '../app-event.js'
import type { AppUser } from '../app-user.js'
import type { AuditLog } from '../audit-log.js'
import type { AuthSession, DeviceJwtPayload, JwtPayload } from '../auth.js'
import type { AutomationConfig } from '../automation-config.js'
import type { Delivery } from '../delivery.js'
import type { Device } from '../device.js'
import type { Membership } from '../membership.js'
import type {
  AbVariant,
  Notification,
  SegmentRule,
  SegmentRules,
} from '../notification.js'
import type { Plan } from '../plan.js'
import type { Tenant } from '../tenant.js'
import type { User, UserWithMembership } from '../user.js'

/**
 * Type compilation tests: these verify that types are correctly defined
 * and can be used as expected. If types are wrong, the file won't compile.
 */
describe('Domain Types — Compilation', () => {
  it('User type has required fields', () => {
    const user: User = {
      id: 'u-1',
      email: 'test@test.com',
      name: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(user.id).toBe('u-1')
    expect(user.email).toBe('test@test.com')
    expect(user.name).toBe('Test User')
  })

  it('User name can be null', () => {
    const user: User = {
      id: 'u-1',
      email: 'test@test.com',
      name: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(user.name).toBeNull()
  })

  it('UserWithMembership extends User with tenant context', () => {
    const user: UserWithMembership = {
      id: 'u-1',
      email: 'test@test.com',
      name: 'Test',
      tenantId: 't-1',
      role: 'editor',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(user.tenantId).toBe('t-1')
    expect(user.role).toBe('editor')
  })

  it('Membership type has required fields', () => {
    const membership: Membership = {
      id: 'm-1',
      tenantId: 't-1',
      userId: 'u-1',
      role: 'owner',
      createdAt: new Date(),
    }
    expect(membership.role).toBe('owner')
  })

  it('AppUser type has required fields', () => {
    const appUser: AppUser = {
      id: 'au-1',
      tenantId: 't-1',
      externalId: 'ext-1',
      email: 'customer@shop.com',
      name: 'Customer',
      pushOptIn: true,
      totalPurchases: 5,
      totalSpent: 500_00,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(appUser.pushOptIn).toBe(true)
    expect(appUser.totalPurchases).toBe(5)
  })

  it('AppUser optional fields can be null', () => {
    const appUser: AppUser = {
      id: 'au-1',
      tenantId: 't-1',
      externalId: null,
      email: null,
      name: null,
      pushOptIn: false,
      totalPurchases: 0,
      totalSpent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(appUser.externalId).toBeNull()
    expect(appUser.email).toBeNull()
  })

  it('Device type has required fields', () => {
    const device: Device = {
      id: 'd-1',
      tenantId: 't-1',
      appUserId: 'au-1',
      deviceToken: 'token-123',
      platform: 'ios',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(device.platform).toBe('ios')
    expect(device.isActive).toBe(true)
  })

  it('Notification type with all fields', () => {
    const notification: Notification = {
      id: 'n-1',
      tenantId: 't-1',
      title: 'Sale!',
      body: 'Get 50% off',
      type: 'manual',
      status: 'draft',
      flowType: null,
      segmentRules: null,
      abVariants: null,
      scheduledAt: null,
      sentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(notification.status).toBe('draft')
    expect(notification.type).toBe('manual')
  })

  it('Notification with automated flow type', () => {
    const notification: Notification = {
      id: 'n-1',
      tenantId: 't-1',
      title: 'You left items!',
      body: 'Come back',
      type: 'automated',
      status: 'scheduled',
      flowType: 'cart_abandoned',
      segmentRules: {
        logic: 'and',
        rules: [{ field: 'totalSpent', operator: 'gte', value: 100 }],
      },
      abVariants: null,
      scheduledAt: new Date(),
      sentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(notification.flowType).toBe('cart_abandoned')
  })

  it('SegmentRule supports all operators', () => {
    const operators: SegmentRule['operator'][] = [
      'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'contains',
    ]
    for (const op of operators) {
      const rule: SegmentRule = { field: 'test', operator: op, value: 1 }
      expect(rule.operator).toBe(op)
    }
  })

  it('SegmentRules supports and/or logic', () => {
    const andRules: SegmentRules = {
      logic: 'and',
      rules: [{ field: 'a', operator: 'eq', value: 1 }],
    }
    const orRules: SegmentRules = {
      logic: 'or',
      rules: [{ field: 'a', operator: 'eq', value: 1 }],
    }
    expect(andRules.logic).toBe('and')
    expect(orRules.logic).toBe('or')
  })

  it('AbVariant has required fields', () => {
    const variant: AbVariant = {
      variantId: 'v-a',
      title: 'Variant A',
      body: 'Body A',
      splitPercent: 50,
    }
    expect(variant.splitPercent).toBe(50)
  })

  it('Delivery type has all status timestamps', () => {
    const delivery: Delivery = {
      id: 'del-1',
      tenantId: 't-1',
      notificationId: 'n-1',
      deviceId: 'd-1',
      appUserId: 'au-1',
      status: 'delivered',
      errorMessage: null,
      sentAt: new Date(),
      deliveredAt: new Date(),
      openedAt: null,
      clickedAt: null,
      convertedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(delivery.status).toBe('delivered')
    expect(delivery.deliveredAt).toBeInstanceOf(Date)
    expect(delivery.openedAt).toBeNull()
  })

  it('AutomationConfig type has required fields', () => {
    const config: AutomationConfig = {
      id: 'ac-1',
      tenantId: 't-1',
      flowType: 'welcome',
      isEnabled: true,
      delaySeconds: 300,
      templateTitle: 'Welcome {{name}}!',
      templateBody: 'Thanks for joining',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(config.flowType).toBe('welcome')
    expect(config.isEnabled).toBe(true)
    expect(config.delaySeconds).toBe(300)
  })

  it('AppConfig type has required fields', () => {
    const config: AppConfig = {
      id: 'app-1',
      tenantId: 't-1',
      appName: 'My Store App',
      primaryColor: '#A855F7',
      secondaryColor: '#0A0A0A',
      iconUrl: 'https://r2.example.com/icon.png',
      splashUrl: null,
      buildStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(config.buildStatus).toBe('pending')
    expect(config.splashUrl).toBeNull()
  })

  it('Plan type has required fields', () => {
    const plan: Plan = {
      id: 'plan-1',
      name: 'starter',
      priceInCents: 12700,
      currency: 'BRL',
      manualNotificationsPerMonth: 15,
      dailyPushLimitPerUser: 2,
      stripePriceId: 'price_starter_123',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(plan.name).toBe('starter')
    expect(plan.dailyPushLimitPerUser).toBe(2)
  })

  it('Plan unlimited fields can be null', () => {
    const plan: Plan = {
      id: 'plan-2',
      name: 'elite',
      priceInCents: 29700,
      currency: 'BRL',
      manualNotificationsPerMonth: null,
      dailyPushLimitPerUser: null,
      stripePriceId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(plan.manualNotificationsPerMonth).toBeNull()
    expect(plan.dailyPushLimitPerUser).toBeNull()
  })

  it('AuditLog type has required fields', () => {
    const log: AuditLog = {
      id: 'log-1',
      tenantId: 't-1',
      userId: 'u-1',
      action: 'notification.created',
      resource: 'notification',
      resourceId: 'n-1',
      details: { title: 'Sale!' },
      createdAt: new Date(),
    }
    expect(log.action).toBe('notification.created')
  })

  it('AuditLog optional fields can be null', () => {
    const log: AuditLog = {
      id: 'log-2',
      tenantId: 't-1',
      userId: null,
      action: 'system.cleanup',
      resource: 'deliveries',
      resourceId: null,
      details: null,
      createdAt: new Date(),
    }
    expect(log.userId).toBeNull()
    expect(log.details).toBeNull()
  })

  it('AppEvent type has required fields', () => {
    const event: AppEvent = {
      id: 'evt-1',
      tenantId: 't-1',
      appUserId: 'au-1',
      eventType: 'product_viewed',
      properties: { productId: 'p-1', price: 99.90 },
      createdAt: new Date(),
    }
    expect(event.eventType).toBe('product_viewed')
  })

  it('AppEvent properties can be null', () => {
    const event: AppEvent = {
      id: 'evt-2',
      tenantId: 't-1',
      appUserId: 'au-1',
      eventType: 'app_opened',
      properties: null,
      createdAt: new Date(),
    }
    expect(event.properties).toBeNull()
  })

  it('Tenant type has required fields', () => {
    const tenant: Tenant = {
      id: 't-1',
      name: 'My Store',
      platform: 'shopify',
      planName: 'business',
      onesignalAppId: 'os-app-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    expect(tenant.platform).toBe('shopify')
  })

  it('JwtPayload has required fields', () => {
    const payload: JwtPayload = {
      sub: 'u-1',
      email: 'test@test.com',
      tenantId: 't-1',
      role: 'owner',
      iat: 1234567890,
      exp: 1234571490,
    }
    expect(payload.sub).toBe('u-1')
  })

  it('JwtPayload tenantId and role can be null (pre-switch)', () => {
    const payload: JwtPayload = {
      sub: 'u-1',
      email: 'test@test.com',
      tenantId: null,
      role: null,
      iat: 1234567890,
      exp: 1234571490,
    }
    expect(payload.tenantId).toBeNull()
    expect(payload.role).toBeNull()
  })

  it('AuthSession always has tenantId and role', () => {
    const session: AuthSession = {
      userId: 'u-1',
      email: 'test@test.com',
      tenantId: 't-1',
      role: 'viewer',
    }
    expect(session.tenantId).toBe('t-1')
  })

  it('DeviceJwtPayload has device-specific fields', () => {
    const payload: DeviceJwtPayload = {
      sub: 'au-1',
      deviceId: 'd-1',
      tenantId: 't-1',
      platform: 'android',
      iat: 1234567890,
      exp: 1234571490,
    }
    expect(payload.platform).toBe('android')
    expect(payload.deviceId).toBe('d-1')
  })
})
