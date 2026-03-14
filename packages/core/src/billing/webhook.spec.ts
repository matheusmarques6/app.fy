import { beforeEach, describe, expect, it } from 'vitest'
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

  async createCheckoutSession(customerId: string, priceId: string, successUrl: string, cancelUrl: string) {
    this.track('createCheckoutSession', [customerId, priceId, successUrl, cancelUrl])
    return { sessionId: 'cs_123', url: 'https://checkout.stripe.com/cs_123' }
  }

  async createPortalSession(customerId: string, returnUrl: string) {
    this.track('createPortalSession', [customerId, returnUrl])
    return { url: 'https://billing.stripe.com/portal/sess_123' }
  }

  async getSubscription(subscriptionId: string) {
    this.track('getSubscription', [subscriptionId])
    return {
      id: 'sub_123',
      status: 'active',
      currentPeriodEnd: 1700000000,
      items: [{ id: 'si_1', priceId: 'price_starter' }],
    }
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
      created: Math.floor(Date.now() / 1000),
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
  allCalls: Array<{ action: string; metadata?: Record<string, unknown> }> = []
  private track(m: string, args: unknown[]) {
    this.calls[m] = (this.calls[m] ?? 0) + 1
    this.lastArgs[m] = args
  }

  async log(tenantId: string, action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>) {
    this.track('log', [tenantId, action, entityType, entityId, metadata])
    this.allCalls.push({ action, metadata })
  }
}

class AutomationRepoSpy {
  calls: Record<string, number> = {}
  lastArgs: Record<string, unknown[]> = {}
  private track(m: string, args: unknown[]) {
    this.calls[m] = (this.calls[m] ?? 0) + 1
    this.lastArgs[m] = args
  }

  async disableAllForTenant(tenantId: string) {
    this.track('disableAllForTenant', [tenantId])
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

// --- Tests ---

describe('Stripe Webhook Lifecycle', () => {
  let stripeProvider: StripeProviderSpy
  let tenantRepo: TenantRepoSpy
  let auditLog: AuditLogServiceSpy
  let automationRepo: AutomationRepoSpy
  let sut: BillingService

  function makeSut(opts?: { withAutomationRepo?: boolean }) {
    stripeProvider = new StripeProviderSpy()
    tenantRepo = new TenantRepoSpy()
    auditLog = new AuditLogServiceSpy()
    automationRepo = new AutomationRepoSpy()
    tenantRepo.findByIdResult = makeTenant()

    sut = new BillingService({
      stripeProvider: stripeProvider as never,
      tenantRepo: tenantRepo as never,
      auditLogService: auditLog as never,
      planPriceRegistry: PLAN_PRICES,
      webhookSecret: 'whsec_test',
      automationRepo: opts?.withAutomationRepo !== false ? automationRepo as never : undefined,
    })
  }

  beforeEach(() => makeSut())

  describe('handlePaymentSucceeded', () => {
    it('should activate tenant', async () => {
      await sut.handlePaymentSucceeded(TENANT_ID)

      expect(tenantRepo.calls.update).toBe(1)
      expect(tenantRepo.lastArgs.update).toEqual([TENANT_ID, { isActive: true }])
    })

    it('should reset notification count to 0', async () => {
      await sut.handlePaymentSucceeded(TENANT_ID)

      expect(tenantRepo.calls.resetNotificationCount).toBe(1)
      expect(tenantRepo.lastArgs.resetNotificationCount).toEqual([TENANT_ID])
    })

    it('should audit log the event', async () => {
      await sut.handlePaymentSucceeded(TENANT_ID)

      expect(auditLog.calls.log).toBe(1)
      expect(auditLog.lastArgs.log?.[1]).toBe('billing.payment.succeeded')
    })
  })

  describe('handlePaymentFailed', () => {
    it('should keep tenant active (grace period) — does NOT deactivate', async () => {
      await sut.handlePaymentFailed(TENANT_ID)

      // Must NOT call deactivate or update isActive to false
      expect(tenantRepo.calls.deactivate).toBeUndefined()
      expect(tenantRepo.calls.update).toBeUndefined()
    })

    it('should audit log with gracePeriodDays', async () => {
      await sut.handlePaymentFailed(TENANT_ID)

      expect(auditLog.calls.log).toBe(1)
      expect(auditLog.lastArgs.log?.[1]).toBe('billing.payment.failed')
      const metadata = auditLog.lastArgs.log?.[4] as Record<string, unknown>
      expect(metadata.gracePeriodDays).toBe(3)
    })
  })

  describe('handleSubscriptionDeleted', () => {
    it('should deactivate tenant', async () => {
      await sut.handleSubscriptionDeleted(TENANT_ID)

      expect(tenantRepo.calls.deactivate).toBe(1)
      expect(tenantRepo.lastArgs.deactivate).toEqual([TENANT_ID])
    })

    it('should pause ALL automations for the tenant', async () => {
      await sut.handleSubscriptionDeleted(TENANT_ID)

      expect(automationRepo.calls.disableAllForTenant).toBe(1)
      expect(automationRepo.lastArgs.disableAllForTenant).toEqual([TENANT_ID])
    })

    it('should work without automationRepo (graceful)', async () => {
      makeSut({ withAutomationRepo: false })

      await sut.handleSubscriptionDeleted(TENANT_ID)

      expect(tenantRepo.calls.deactivate).toBe(1)
      // Should not throw even without automationRepo
    })

    it('should audit log the event', async () => {
      await sut.handleSubscriptionDeleted(TENANT_ID)

      expect(auditLog.calls.log).toBe(1)
      expect(auditLog.lastArgs.log?.[1]).toBe('billing.subscription.deleted')
    })
  })

  describe('handleCheckoutCompleted', () => {
    it('should save stripe IDs to tenant', async () => {
      await sut.handleCheckoutCompleted(TENANT_ID, 'cus_new', 'sub_new', 'starter')

      expect(tenantRepo.calls.updateStripeIds).toBe(1)
      expect(tenantRepo.lastArgs.updateStripeIds).toEqual([TENANT_ID, 'cus_new', 'sub_new'])
    })

    it('should audit log with plan details', async () => {
      await sut.handleCheckoutCompleted(TENANT_ID, 'cus_new', 'sub_new', 'business')

      expect(auditLog.calls.log).toBe(1)
      expect(auditLog.lastArgs.log?.[1]).toBe('billing.checkout.completed')
      const metadata = auditLog.lastArgs.log?.[4] as Record<string, unknown>
      expect(metadata.planName).toBe('business')
      expect(metadata.stripeCustomerId).toBe('cus_new')
      expect(metadata.stripeSubscriptionId).toBe('sub_new')
    })
  })

  describe('constructWebhookEvent', () => {
    it('should delegate to stripeProvider with correct webhook secret', () => {
      const result = sut.constructWebhookEvent('raw-body', 'sig_abc')

      expect(result.type).toBe('checkout.session.completed')
      expect(stripeProvider.lastArgs.constructWebhookEvent).toEqual(['raw-body', 'sig_abc', 'whsec_test'])
    })

    it('should return event with created timestamp', () => {
      const result = sut.constructWebhookEvent('raw', 'sig')

      expect(result.created).toBeTypeOf('number')
      expect(result.id).toBe('evt_123')
    })
  })
})
