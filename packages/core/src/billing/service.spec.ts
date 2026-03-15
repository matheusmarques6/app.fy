import { beforeEach, describe, expect, it } from 'vitest'
import { BillingError, TenantNotFoundError } from '../errors.js'
import type { TenantRow } from '../tenants/repository.js'
import type { PlanPriceRegistry } from './service.js'
import { BillingService } from './service.js'

// --- Spies ---

class StripeProviderSpy {
  calls: Record<string, unknown[][]> = {}
  lastArgs: Record<string, unknown[]> = {}
  private track(m: string, args: unknown[]) {
    this.calls[m] = this.calls[m] ?? []
    this.calls[m].push(args)
    this.lastArgs[m] = args
  }

  checkoutResult = { sessionId: 'cs_123', url: 'https://checkout.stripe.com/cs_123' }
  portalResult = { url: 'https://billing.stripe.com/portal/sess_123' }
  subscriptionResult = {
    id: 'sub_123',
    status: 'active',
    currentPeriodEnd: 1700000000,
    items: [{ id: 'si_1', priceId: 'price_starter' }],
  }

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    this.track('createCheckoutSession', [customerId, priceId, successUrl, cancelUrl])
    return this.checkoutResult
  }

  async createPortalSession(customerId: string, returnUrl: string) {
    this.track('createPortalSession', [customerId, returnUrl])
    return this.portalResult
  }

  async getSubscription(subscriptionId: string) {
    this.track('getSubscription', [subscriptionId])
    return this.subscriptionResult
  }

  async updateSubscription(subscriptionId: string, itemId: string, newPriceId: string) {
    this.track('updateSubscription', [subscriptionId, itemId, newPriceId])
    return {
      id: subscriptionId,
      status: 'active',
      currentPeriodEnd: 1700000000,
      items: [{ id: itemId, priceId: newPriceId }],
    }
  }

  async cancelSubscription(subscriptionId: string) {
    this.track('cancelSubscription', [subscriptionId])
  }

  constructWebhookEvent(rawBody: string, signature: string, webhookSecret: string) {
    this.track('constructWebhookEvent', [rawBody, signature, webhookSecret])
    return {
      id: 'evt_123',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_123' } },
      created: 1700000000,
    }
  }
}

class TenantRepoSpy {
  calls: Record<string, number> = {}
  lastArgs: Record<string, unknown[]> = {}
  findByIdResult: TenantRow | undefined = undefined
  private track(m: string, args: unknown[]) {
    this.calls[m] = (this.calls[m] ?? 0) + 1
    this.lastArgs[m] = args
  }

  async findById(tenantId: string) {
    this.track('findById', [tenantId])
    return this.findByIdResult
  }

  async update(tenantId: string, input: unknown) {
    this.track('update', [tenantId, input])
    return this.findByIdResult
  }

  async updateStripeIds(tenantId: string, stripeCustomerId: string, stripeSubscriptionId: string) {
    this.track('updateStripeIds', [tenantId, stripeCustomerId, stripeSubscriptionId])
  }

  async resetNotificationCount(tenantId: string) {
    this.track('resetNotificationCount', [tenantId])
  }

  async deactivate(tenantId: string) {
    this.track('deactivate', [tenantId])
  }
}

class AuditLogServiceSpy {
  calls: Record<string, number> = {}
  lastArgs: Record<string, unknown[]> = {}
  private track(m: string, args: unknown[]) {
    this.calls[m] = (this.calls[m] ?? 0) + 1
    this.lastArgs[m] = args
  }

  async log(
    tenantId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ) {
    this.track('log', [tenantId, action, entityType, entityId, metadata])
  }
}

// --- Helpers ---

const TENANT_ID = 'tenant-1'

const PLAN_PRICES: PlanPriceRegistry = {
  starter: 'price_starter_123',
  business: 'price_business_123',
  elite: 'price_elite_123',
}

function makeTenant(overrides: Partial<TenantRow> = {}): TenantRow {
  return {
    id: TENANT_ID,
    name: 'Test Tenant',
    slug: 'test-tenant',
    platform: 'starter',
    platformStoreUrl: null,
    platformCredentials: null,
    onesignalAppId: null,
    isActive: true,
    notificationCountCurrentPeriod: 0,
    notificationLimit: 15,
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    planId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('BillingService', () => {
  let stripeProvider: StripeProviderSpy
  let tenantRepo: TenantRepoSpy
  let auditLog: AuditLogServiceSpy
  let sut: BillingService

  function makeSut() {
    stripeProvider = new StripeProviderSpy()
    tenantRepo = new TenantRepoSpy()
    auditLog = new AuditLogServiceSpy()
    tenantRepo.findByIdResult = makeTenant()

    sut = new BillingService({
      stripeProvider: stripeProvider as never,
      tenantRepo: tenantRepo as never,
      auditLogService: auditLog as never,
      planPriceRegistry: PLAN_PRICES,
      webhookSecret: 'whsec_test',
    })
  }

  beforeEach(() => makeSut())

  describe('createCheckout', () => {
    it('should call stripeProvider with correct priceId for plan', async () => {
      const result = await sut.createCheckout(TENANT_ID, 'starter', 'https://ok', 'https://cancel')

      expect(result).toEqual({ sessionId: 'cs_123', url: 'https://checkout.stripe.com/cs_123' })
      expect(stripeProvider.lastArgs.createCheckoutSession).toEqual([
        'cus_123',
        'price_starter_123',
        'https://ok',
        'https://cancel',
      ])
    })

    it('should throw TenantNotFoundError when tenant not found', async () => {
      tenantRepo.findByIdResult = undefined

      await expect(
        sut.createCheckout(TENANT_ID, 'starter', 'https://ok', 'https://cancel'),
      ).rejects.toThrow(TenantNotFoundError)
    })

    it('should throw BillingError when tenant has no stripeCustomerId', async () => {
      tenantRepo.findByIdResult = makeTenant({ stripeCustomerId: null })

      await expect(
        sut.createCheckout(TENANT_ID, 'starter', 'https://ok', 'https://cancel'),
      ).rejects.toThrow(BillingError)
    })

    it('should throw BillingError for unknown plan name', async () => {
      await expect(
        sut.createCheckout(TENANT_ID, 'unknown' as never, 'https://ok', 'https://cancel'),
      ).rejects.toThrow(BillingError)
    })

    it('should log audit event on successful checkout', async () => {
      await sut.createCheckout(TENANT_ID, 'starter', 'https://ok', 'https://cancel')

      expect(auditLog.calls.log).toBe(1)
      expect(auditLog.lastArgs.log?.[1]).toBe('billing.checkout.created')
    })
  })

  describe('createPortalSession', () => {
    it('should return portal URL', async () => {
      const result = await sut.createPortalSession(TENANT_ID, 'https://return')

      expect(result.url).toBe('https://billing.stripe.com/portal/sess_123')
      expect(stripeProvider.lastArgs.createPortalSession).toEqual(['cus_123', 'https://return'])
    })

    it('should throw TenantNotFoundError when tenant not found', async () => {
      tenantRepo.findByIdResult = undefined

      await expect(sut.createPortalSession(TENANT_ID, 'https://return')).rejects.toThrow(
        TenantNotFoundError,
      )
    })

    it('should throw BillingError when no stripeCustomerId', async () => {
      tenantRepo.findByIdResult = makeTenant({ stripeCustomerId: null })

      await expect(sut.createPortalSession(TENANT_ID, 'https://return')).rejects.toThrow(
        BillingError,
      )
    })

    it('should log audit event', async () => {
      await sut.createPortalSession(TENANT_ID, 'https://return')

      expect(auditLog.calls.log).toBe(1)
      expect(auditLog.lastArgs.log?.[1]).toBe('billing.portal.created')
    })
  })

  describe('getSubscription', () => {
    it('should return subscription details', async () => {
      const result = await sut.getSubscription(TENANT_ID)

      expect(result).toBeDefined()
      expect(result!.id).toBe('sub_123')
      expect(result!.status).toBe('active')
      expect(result!.currentPeriodEnd).toBeInstanceOf(Date)
      expect(result!.items).toHaveLength(1)
    })

    it('should return undefined when tenant has no stripeSubscriptionId', async () => {
      tenantRepo.findByIdResult = makeTenant({ stripeSubscriptionId: null })

      const result = await sut.getSubscription(TENANT_ID)
      expect(result).toBeUndefined()
    })

    it('should throw TenantNotFoundError when tenant not found', async () => {
      tenantRepo.findByIdResult = undefined

      await expect(sut.getSubscription(TENANT_ID)).rejects.toThrow(TenantNotFoundError)
    })
  })

  describe('handleCheckoutCompleted', () => {
    it('should save stripe IDs to tenant', async () => {
      await sut.handleCheckoutCompleted(TENANT_ID, 'cus_new', 'sub_new', 'starter')

      expect(tenantRepo.calls.updateStripeIds).toBe(1)
      expect(tenantRepo.lastArgs.updateStripeIds).toEqual([TENANT_ID, 'cus_new', 'sub_new'])
    })

    it('should log audit event', async () => {
      await sut.handleCheckoutCompleted(TENANT_ID, 'cus_new', 'sub_new', 'business')

      expect(auditLog.calls.log).toBe(1)
      expect(auditLog.lastArgs.log?.[1]).toBe('billing.checkout.completed')
      expect((auditLog.lastArgs.log?.[4] as Record<string, unknown>)?.planName).toBe('business')
    })
  })

  describe('handleUpgrade', () => {
    it('should reset notification count immediately', async () => {
      await sut.handleUpgrade(TENANT_ID, 'business')

      expect(tenantRepo.calls.resetNotificationCount).toBe(1)
      expect(tenantRepo.lastArgs.resetNotificationCount).toEqual([TENANT_ID])
    })

    it('should update subscription in Stripe', async () => {
      await sut.handleUpgrade(TENANT_ID, 'business')

      expect(stripeProvider.calls.updateSubscription).toHaveLength(1)
      expect(stripeProvider.lastArgs.updateSubscription).toEqual([
        'sub_123',
        'si_1',
        'price_business_123',
      ])
    })

    it('should log audit event', async () => {
      await sut.handleUpgrade(TENANT_ID, 'elite')

      expect(auditLog.calls.log).toBe(1)
      expect(auditLog.lastArgs.log?.[1]).toBe('billing.upgrade')
    })

    it('should throw when tenant not found', async () => {
      tenantRepo.findByIdResult = undefined

      await expect(sut.handleUpgrade(TENANT_ID, 'business')).rejects.toThrow(TenantNotFoundError)
    })

    it('should throw when no subscription', async () => {
      tenantRepo.findByIdResult = makeTenant({ stripeSubscriptionId: null })

      await expect(sut.handleUpgrade(TENANT_ID, 'business')).rejects.toThrow(BillingError)
    })
  })

  describe('handleDowngrade', () => {
    it('should NOT reset notification count (deferred)', async () => {
      await sut.handleDowngrade(TENANT_ID, 'starter')

      expect(tenantRepo.calls.resetNotificationCount).toBeUndefined()
    })

    it('should log audit event with scheduled info', async () => {
      await sut.handleDowngrade(TENANT_ID, 'starter')

      expect(auditLog.calls.log).toBe(1)
      expect(auditLog.lastArgs.log?.[1]).toBe('billing.downgrade.scheduled')
      expect((auditLog.lastArgs.log?.[4] as Record<string, unknown>)?.effectiveAt).toBe(
        'next_billing_cycle',
      )
    })

    it('should throw when tenant not found', async () => {
      tenantRepo.findByIdResult = undefined

      await expect(sut.handleDowngrade(TENANT_ID, 'starter')).rejects.toThrow(TenantNotFoundError)
    })
  })

  describe('handlePaymentSucceeded', () => {
    it('should activate tenant and reset notification count', async () => {
      await sut.handlePaymentSucceeded(TENANT_ID)

      expect(tenantRepo.calls.update).toBe(1)
      expect(tenantRepo.lastArgs.update).toEqual([TENANT_ID, { isActive: true }])
      expect(tenantRepo.calls.resetNotificationCount).toBe(1)
    })

    it('should log audit event', async () => {
      await sut.handlePaymentSucceeded(TENANT_ID)

      expect(auditLog.calls.log).toBe(1)
      expect(auditLog.lastArgs.log?.[1]).toBe('billing.payment.succeeded')
    })
  })

  describe('handleSubscriptionDeleted', () => {
    it('should deactivate tenant', async () => {
      await sut.handleSubscriptionDeleted(TENANT_ID)

      expect(tenantRepo.calls.deactivate).toBe(1)
      expect(tenantRepo.lastArgs.deactivate).toEqual([TENANT_ID])
    })

    it('should log audit event', async () => {
      await sut.handleSubscriptionDeleted(TENANT_ID)

      expect(auditLog.calls.log).toBe(1)
      expect(auditLog.lastArgs.log?.[1]).toBe('billing.subscription.deleted')
    })
  })

  describe('handlePaymentFailed', () => {
    it('should NOT deactivate or update tenant', async () => {
      await sut.handlePaymentFailed(TENANT_ID)

      expect(tenantRepo.calls.deactivate).toBeUndefined()
      expect(tenantRepo.calls.update).toBeUndefined()
    })

    it('should log audit event with grace period', async () => {
      await sut.handlePaymentFailed(TENANT_ID)

      expect(auditLog.calls.log).toBe(1)
      expect(auditLog.lastArgs.log?.[1]).toBe('billing.payment.failed')
      expect((auditLog.lastArgs.log?.[4] as Record<string, unknown>)?.gracePeriodDays).toBe(3)
    })
  })

  describe('constructWebhookEvent', () => {
    it('should delegate to stripeProvider', () => {
      const result = sut.constructWebhookEvent('raw', 'sig_123')

      expect(result.type).toBe('checkout.session.completed')
      expect(stripeProvider.lastArgs.constructWebhookEvent).toEqual([
        'raw',
        'sig_123',
        'whsec_test',
      ])
    })
  })
})
