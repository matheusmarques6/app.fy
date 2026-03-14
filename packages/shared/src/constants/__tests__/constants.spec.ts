import { describe, expect, it } from 'vitest'

import { AUTH_CONFIG } from '../auth.js'
import {
  appEventTypes,
  buildStatuses,
  deliveryStatuses,
  devicePlatforms,
  notificationStatuses,
  notificationTypes,
  platforms,
} from '../event-types.js'
import { flowTypes } from '../flow-types.js'
import { FREQUENCY_CAPS, PLAN_LIMITS } from '../plan-limits.js'
import { planNames, plans } from '../plans.js'
import { QUEUE_NAMES } from '../queues.js'
import { RATE_LIMITS } from '../rate-limits.js'
import { membershipRoles, rolePermissions } from '../roles.js'

describe('AUTH_CONFIG', () => {
  it('should be frozen', () => {
    expect(Object.isFrozen(AUTH_CONFIG)).toBe(true)
  })

  it('should have token expiry of 1 hour (3600s)', () => {
    expect(AUTH_CONFIG.tokenExpirySeconds).toBe(3600)
  })

  it('should have refresh token expiry of 7 days', () => {
    expect(AUTH_CONFIG.refreshTokenExpirySeconds).toBe(604800)
  })

  it('should have issuer set to appfy', () => {
    expect(AUTH_CONFIG.issuer).toBe('appfy')
  })

  it('should have console and device audiences', () => {
    expect(AUTH_CONFIG.audienceConsole).toBe('console')
    expect(AUTH_CONFIG.audienceDevice).toBe('device')
  })
})

describe('QUEUE_NAMES', () => {
  it('should be frozen', () => {
    expect(Object.isFrozen(QUEUE_NAMES)).toBe(true)
  })

  it('should have push-dispatch queue', () => {
    expect(QUEUE_NAMES.pushDispatch).toBe('push-dispatch')
  })

  it('should have data-ingestion queue', () => {
    expect(QUEUE_NAMES.dataIngestion).toBe('data-ingestion')
  })

  it('should have analytics queue', () => {
    expect(QUEUE_NAMES.analytics).toBe('analytics')
  })

  it('should have exactly 3 queues', () => {
    expect(Object.keys(QUEUE_NAMES)).toHaveLength(3)
  })
})

describe('RATE_LIMITS', () => {
  it('should be frozen', () => {
    expect(Object.isFrozen(RATE_LIMITS)).toBe(true)
  })

  it('admin should allow 100 requests per minute', () => {
    expect(RATE_LIMITS.admin.windowMs).toBe(60_000)
    expect(RATE_LIMITS.admin.maxRequests).toBe(100)
  })

  it('public should allow 20 requests per second', () => {
    expect(RATE_LIMITS.public.windowMs).toBe(1_000)
    expect(RATE_LIMITS.public.maxRequests).toBe(20)
  })
})

describe('PLAN_LIMITS', () => {
  it('should be frozen', () => {
    expect(Object.isFrozen(PLAN_LIMITS)).toBe(true)
  })

  it('starter should have 15 manual/month and 2 push/day', () => {
    expect(PLAN_LIMITS.starter.manualNotificationsPerMonth).toBe(15)
    expect(PLAN_LIMITS.starter.dailyPushLimitPerUser).toBe(2)
  })

  it('business should have unlimited manual and 4 push/day', () => {
    expect(PLAN_LIMITS.business.manualNotificationsPerMonth).toBeNull()
    expect(PLAN_LIMITS.business.dailyPushLimitPerUser).toBe(4)
  })

  it('elite should have unlimited manual and unlimited daily', () => {
    expect(PLAN_LIMITS.elite.manualNotificationsPerMonth).toBeNull()
    expect(PLAN_LIMITS.elite.dailyPushLimitPerUser).toBeNull()
  })

  it('should have entries for all plan names', () => {
    for (const name of planNames) {
      expect(PLAN_LIMITS[name]).toBeDefined()
    }
  })
})

describe('FREQUENCY_CAPS', () => {
  it('should be frozen', () => {
    expect(Object.isFrozen(FREQUENCY_CAPS)).toBe(true)
  })

  it('should limit cart_abandoned to 1 per session', () => {
    expect(FREQUENCY_CAPS.maxCartAbandonedPerSession).toBe(1)
  })

  it('counter should reset at UTC midnight', () => {
    expect(FREQUENCY_CAPS.counterResetUtcHour).toBe(0)
  })

  it('admin override should be allowed for manual but NOT automated', () => {
    expect(FREQUENCY_CAPS.adminOverrideManual).toBe(true)
    expect(FREQUENCY_CAPS.adminOverrideAutomated).toBe(false)
  })
})

describe('Enums', () => {
  it('flowTypes should have 9 flow types', () => {
    expect(flowTypes).toHaveLength(9)
    expect(flowTypes).toContain('cart_abandoned')
    expect(flowTypes).toContain('pix_recovery')
    expect(flowTypes).toContain('boleto_recovery')
    expect(flowTypes).toContain('welcome')
    expect(flowTypes).toContain('checkout_abandoned')
    expect(flowTypes).toContain('order_confirmed')
    expect(flowTypes).toContain('tracking_created')
    expect(flowTypes).toContain('browse_abandoned')
    expect(flowTypes).toContain('upsell')
  })

  it('appEventTypes should have 6 event types', () => {
    expect(appEventTypes).toHaveLength(6)
    expect(appEventTypes).toContain('app_opened')
    expect(appEventTypes).toContain('product_viewed')
    expect(appEventTypes).toContain('add_to_cart')
    expect(appEventTypes).toContain('purchase_completed')
    expect(appEventTypes).toContain('push_opened')
    expect(appEventTypes).toContain('push_clicked')
  })

  it('deliveryStatuses should have 7 statuses in correct order', () => {
    expect(deliveryStatuses).toEqual([
      'pending', 'sent', 'delivered', 'opened', 'clicked', 'converted', 'failed',
    ])
  })

  it('notificationStatuses should have 6 statuses', () => {
    expect(notificationStatuses).toEqual([
      'draft', 'scheduled', 'sending', 'sent', 'completed', 'failed',
    ])
  })

  it('notificationTypes should be manual and automated', () => {
    expect(notificationTypes).toEqual(['manual', 'automated'])
  })

  it('membershipRoles should be owner, editor, viewer', () => {
    expect(membershipRoles).toEqual(['owner', 'editor', 'viewer'])
  })

  it('platforms should be shopify and nuvemshop', () => {
    expect(platforms).toEqual(['shopify', 'nuvemshop'])
  })

  it('devicePlatforms should be android and ios', () => {
    expect(devicePlatforms).toEqual(['android', 'ios'])
  })

  it('buildStatuses should be pending, building, ready, published', () => {
    expect(buildStatuses).toEqual(['pending', 'building', 'ready', 'published'])
  })
})

describe('Plans', () => {
  it('should have 3 plan names', () => {
    expect(planNames).toHaveLength(3)
    expect(planNames).toEqual(['starter', 'business', 'elite'])
  })

  it('starter should cost R$127 (12700 cents)', () => {
    expect(plans.starter.priceInCents).toBe(12700)
  })

  it('business should cost R$197 (19700 cents)', () => {
    expect(plans.business.priceInCents).toBe(19700)
  })

  it('elite should cost R$297 (29700 cents)', () => {
    expect(plans.elite.priceInCents).toBe(29700)
  })

  it('all plans use BRL currency', () => {
    for (const name of planNames) {
      expect(plans[name].currency).toBe('BRL')
    }
  })

  it('starter has 15 manual notifications limit', () => {
    expect(plans.starter.manualNotificationsPerMonth).toBe(15)
  })

  it('business and elite have unlimited manual notifications', () => {
    expect(plans.business.manualNotificationsPerMonth).toBeNull()
    expect(plans.elite.manualNotificationsPerMonth).toBeNull()
  })

  it('all plans have unlimited automated notifications', () => {
    for (const name of planNames) {
      expect(plans[name].unlimitedAutomated).toBe(true)
    }
  })
})

describe('Role Permissions', () => {
  it('viewer is read-only', () => {
    expect(rolePermissions.viewer.read).toBe(true)
    expect(rolePermissions.viewer.write).toBe(false)
    expect(rolePermissions.viewer.delete).toBe(false)
    expect(rolePermissions.viewer.billing).toBe(false)
    expect(rolePermissions.viewer.members).toBe(false)
  })

  it('editor can read and write but not delete/billing/members', () => {
    expect(rolePermissions.editor.read).toBe(true)
    expect(rolePermissions.editor.write).toBe(true)
    expect(rolePermissions.editor.delete).toBe(false)
    expect(rolePermissions.editor.billing).toBe(false)
    expect(rolePermissions.editor.members).toBe(false)
  })

  it('owner has total access', () => {
    const perms = rolePermissions.owner
    expect(Object.values(perms).every((v) => v === true)).toBe(true)
  })
})
