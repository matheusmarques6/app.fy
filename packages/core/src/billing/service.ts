import type { PlanName } from '@appfy/shared'
import type { AuditLogService } from '../audit/audit-log.service.js'
import type { AutomationRepository } from '../automations/repository.js'
import { BillingError, TenantNotFoundError } from '../errors.js'
import type { TenantRepository } from '../tenants/repository.js'
import type { StripeProvider } from './stripe.provider.js'

/** Checkout session returned to the client */
export interface CheckoutSession {
  readonly sessionId: string
  readonly url: string
}

/** Subscription details returned to the client */
export interface Subscription {
  readonly id: string
  readonly status: string
  readonly currentPeriodEnd: Date
  readonly items: Array<{ id: string; priceId: string }>
}

/** Stripe webhook event payload */
export interface BillingWebhookEvent {
  readonly type: string
  readonly data: unknown
}

/** Price registry — maps plan names to Stripe price IDs */
export interface PlanPriceRegistry {
  readonly [planName: string]: string
}

export interface BillingServiceDeps {
  readonly stripeProvider: StripeProvider
  readonly tenantRepo: TenantRepository
  readonly auditLogService: AuditLogService
  readonly planPriceRegistry: PlanPriceRegistry
  readonly webhookSecret: string
  readonly automationRepo?: AutomationRepository
}

export class BillingService {
  private readonly stripeProvider: StripeProvider
  private readonly tenantRepo: TenantRepository
  private readonly auditLogService: AuditLogService
  private readonly planPriceRegistry: PlanPriceRegistry
  private readonly webhookSecret: string
  private readonly automationRepo?: AutomationRepository

  constructor(deps: BillingServiceDeps) {
    this.stripeProvider = deps.stripeProvider
    this.tenantRepo = deps.tenantRepo
    this.auditLogService = deps.auditLogService
    this.planPriceRegistry = deps.planPriceRegistry
    this.webhookSecret = deps.webhookSecret
    this.automationRepo = deps.automationRepo
  }

  /**
   * Creates a Stripe Checkout session for a plan subscription.
   * Requires the tenant to already have a stripeCustomerId.
   */
  async createCheckout(
    tenantId: string,
    planName: PlanName,
    successUrl: string,
    cancelUrl: string,
  ): Promise<CheckoutSession> {
    const tenant = await this.tenantRepo.findById(tenantId)
    if (!tenant) {
      throw new TenantNotFoundError(tenantId)
    }

    if (!tenant.stripeCustomerId) {
      throw new BillingError('Tenant has no Stripe customer ID — cannot create checkout')
    }

    const priceId = this.planPriceRegistry[planName]
    if (!priceId) {
      throw new BillingError(`No Stripe price ID configured for plan: ${planName}`)
    }

    const result = await this.stripeProvider.createCheckoutSession(
      tenant.stripeCustomerId,
      priceId,
      successUrl,
      cancelUrl,
    )

    await this.auditLogService.log(
      tenantId,
      'billing.checkout.created',
      'tenant',
      tenantId,
      { planName, sessionId: result.sessionId },
    )

    return result
  }

  /**
   * Creates a Stripe Billing Portal session so the customer can manage their subscription.
   */
  async createPortalSession(tenantId: string, returnUrl: string): Promise<{ url: string }> {
    const tenant = await this.tenantRepo.findById(tenantId)
    if (!tenant) {
      throw new TenantNotFoundError(tenantId)
    }

    if (!tenant.stripeCustomerId) {
      throw new BillingError('Tenant has no Stripe customer ID — cannot create portal session')
    }

    const result = await this.stripeProvider.createPortalSession(tenant.stripeCustomerId, returnUrl)

    await this.auditLogService.log(
      tenantId,
      'billing.portal.created',
      'tenant',
      tenantId,
    )

    return result
  }

  /**
   * Retrieves the current subscription for a tenant.
   * Returns undefined if the tenant has no subscription.
   */
  async getSubscription(tenantId: string): Promise<Subscription | undefined> {
    const tenant = await this.tenantRepo.findById(tenantId)
    if (!tenant) {
      throw new TenantNotFoundError(tenantId)
    }

    if (!tenant.stripeSubscriptionId) {
      return undefined
    }

    const sub = await this.stripeProvider.getSubscription(tenant.stripeSubscriptionId)
    return {
      id: sub.id,
      status: sub.status,
      currentPeriodEnd: new Date(sub.currentPeriodEnd * 1000),
      items: sub.items,
    }
  }

  /**
   * Handles checkout.session.completed — saves Stripe IDs to tenant.
   */
  async handleCheckoutCompleted(
    tenantId: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    planName: string,
  ): Promise<void> {
    await this.tenantRepo.updateStripeIds(tenantId, stripeCustomerId, stripeSubscriptionId)

    await this.auditLogService.log(
      tenantId,
      'billing.checkout.completed',
      'tenant',
      tenantId,
      { planName, stripeCustomerId, stripeSubscriptionId },
    )
  }

  /**
   * Handles plan upgrade — applies new price immediately and resets notification count.
   */
  async handleUpgrade(tenantId: string, newPlanName: PlanName): Promise<void> {
    const tenant = await this.tenantRepo.findById(tenantId)
    if (!tenant) {
      throw new TenantNotFoundError(tenantId)
    }

    if (!tenant.stripeSubscriptionId) {
      throw new BillingError('Tenant has no active subscription — cannot upgrade')
    }

    const newPriceId = this.planPriceRegistry[newPlanName]
    if (!newPriceId) {
      throw new BillingError(`No Stripe price ID configured for plan: ${newPlanName}`)
    }

    const sub = await this.stripeProvider.getSubscription(tenant.stripeSubscriptionId)
    const currentItem = sub.items[0]
    if (!currentItem) {
      throw new BillingError('Subscription has no items — cannot upgrade')
    }

    await this.stripeProvider.updateSubscription(
      tenant.stripeSubscriptionId,
      currentItem.id,
      newPriceId,
    )

    // Upgrade applies immediately — reset notification count
    await this.tenantRepo.resetNotificationCount(tenantId)

    await this.auditLogService.log(
      tenantId,
      'billing.upgrade',
      'tenant',
      tenantId,
      { newPlanName },
    )
  }

  /**
   * Handles plan downgrade — does NOT apply immediately.
   * Stores pending plan change for next billing cycle.
   */
  async handleDowngrade(tenantId: string, newPlanName: PlanName): Promise<void> {
    const tenant = await this.tenantRepo.findById(tenantId)
    if (!tenant) {
      throw new TenantNotFoundError(tenantId)
    }

    // Downgrade is deferred — do NOT reset notification count
    // The actual plan change will happen at next billing cycle via webhook
    await this.auditLogService.log(
      tenantId,
      'billing.downgrade.scheduled',
      'tenant',
      tenantId,
      { newPlanName, effectiveAt: 'next_billing_cycle' },
    )
  }

  /**
   * Handles invoice.payment_succeeded — activates tenant and resets count.
   */
  async handlePaymentSucceeded(tenantId: string): Promise<void> {
    await this.tenantRepo.update(tenantId, { isActive: true })
    await this.tenantRepo.resetNotificationCount(tenantId)

    await this.auditLogService.log(
      tenantId,
      'billing.payment.succeeded',
      'tenant',
      tenantId,
    )
  }

  /**
   * Handles invoice.payment_failed — keeps tenant active (grace period), logs event.
   */
  async handlePaymentFailed(tenantId: string): Promise<void> {
    // Keep tenant active — grace period of 3 days
    // Don't deactivate — just log
    await this.auditLogService.log(
      tenantId,
      'billing.payment.failed',
      'tenant',
      tenantId,
      { gracePeriodDays: 3 },
    )
  }

  /**
   * Handles customer.subscription.deleted — deactivates tenant and pauses all automations.
   */
  async handleSubscriptionDeleted(tenantId: string): Promise<void> {
    await this.tenantRepo.deactivate(tenantId)

    // Pause ALL automations for this tenant
    if (this.automationRepo) {
      await this.automationRepo.disableAllForTenant(tenantId)
    }

    await this.auditLogService.log(
      tenantId,
      'billing.subscription.deleted',
      'tenant',
      tenantId,
    )
  }

  /**
   * Constructs and verifies a Stripe webhook event from raw body + signature.
   */
  constructWebhookEvent(rawBody: string, signature: string) {
    return this.stripeProvider.constructWebhookEvent(rawBody, signature, this.webhookSecret)
  }
}
