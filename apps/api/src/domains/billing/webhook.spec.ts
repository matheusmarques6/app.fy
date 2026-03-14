import type { Dependencies } from '@appfy/core'
import { InMemoryIdempotencyStore } from '@appfy/core'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'
import { errorHandler } from '../../middleware/error-handler.js'
import { createBillingHandlers } from './handlers.js'

// ──────────────────────────────────────────────
// BillingServiceSpy
// ──────────────────────────────────────────────

interface StripeEvent {
  id: string
  type: string
  created: number
  data: {
    object: {
      customer: string
      subscription: string
      metadata: Record<string, string>
    }
  }
}

class BillingServiceSpy {
  /** Event returned by constructWebhookEvent (configurable per test) */
  event: StripeEvent = {
    id: 'evt_test_default',
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        customer: 'cus_test',
        subscription: 'sub_test',
        metadata: { tenantId: 'tenant-1', planName: 'business' },
      },
    },
  }

  /** If set, constructWebhookEvent will throw this error */
  constructError: Error | null = null

  // Call tracking
  constructCalls: Array<{ rawBody: string; signature: string }> = []
  checkoutCompletedCalls: Array<{
    tenantId: string
    customerId: string
    subscriptionId: string
    planName: string
  }> = []
  paymentSucceededCalls: string[] = []
  paymentFailedCalls: string[] = []
  subscriptionDeletedCalls: string[] = []

  constructWebhookEvent(rawBody: string, signature: string): StripeEvent {
    this.constructCalls.push({ rawBody, signature })
    if (this.constructError) {
      throw this.constructError
    }
    return this.event
  }

  async handleCheckoutCompleted(
    tenantId: string,
    customerId: string,
    subscriptionId: string,
    planName: string,
  ): Promise<void> {
    this.checkoutCompletedCalls.push({ tenantId, customerId, subscriptionId, planName })
  }

  async handlePaymentSucceeded(tenantId: string): Promise<void> {
    this.paymentSucceededCalls.push(tenantId)
  }

  async handlePaymentFailed(tenantId: string): Promise<void> {
    this.paymentFailedCalls.push(tenantId)
  }

  async handleSubscriptionDeleted(tenantId: string): Promise<void> {
    this.subscriptionDeletedCalls.push(tenantId)
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

interface MakeSutResult {
  app: Hono
  billingServiceSpy: BillingServiceSpy
}

function makeSut(): MakeSutResult {
  const billingServiceSpy = new BillingServiceSpy()

  const deps = {
    billingService: billingServiceSpy,
    idempotencyStore: new InMemoryIdempotencyStore(),
  } as unknown as Dependencies

  const handlers = createBillingHandlers(deps)

  const app = new Hono()
  app.onError(errorHandler)
  app.post('/billing/webhook', handlers.webhook)

  return { app, billingServiceSpy }
}

function makeEvent(overrides: Partial<StripeEvent> = {}): StripeEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        customer: 'cus_test',
        subscription: 'sub_test',
        metadata: { tenantId: 'tenant-1', planName: 'business' },
      },
    },
    ...overrides,
  }
}

function postWebhook(app: Hono, headers: Record<string, string> = {}, body = '{}') {
  return app.request('/billing/webhook', {
    method: 'POST',
    headers,
    body,
  })
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('Billing Webhook HTTP (Layer 4)', () => {
  let sut: MakeSutResult

  beforeEach(() => {
    sut = makeSut()
  })

  describe('POST /billing/webhook', () => {
    // ── Signature verification ────────────────

    describe('signature verification', () => {
      it('should return 400 when Stripe-Signature header is missing', async () => {
        // Arrange
        const { app } = sut

        // Act
        const res = await postWebhook(app)

        // Assert
        expect(res.status).toBe(400)
        const body = (await res.json()) as { error: { code: string; message: string } }
        expect(body.error.code).toBe('MISSING_SIGNATURE')
        expect(body.error.message).toBe('Missing Stripe-Signature header')
      })

      it('should return 400 when signature verification fails (constructWebhookEvent throws)', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        billingServiceSpy.constructError = new Error('Invalid signature')

        // Act
        const res = await postWebhook(app, { 'Stripe-Signature': 'invalid_sig' })

        // Assert
        expect(res.status).toBe(400)
        const body = (await res.json()) as { error: { code: string } }
        expect(body.error.code).toBe('WEBHOOK_ERROR')
      })

      it('should pass rawBody and signature to constructWebhookEvent', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        billingServiceSpy.event = makeEvent()
        const rawBody = JSON.stringify({ test: true })

        // Act
        await postWebhook(app, { 'Stripe-Signature': 'sig_header_value' }, rawBody)

        // Assert
        expect(billingServiceSpy.constructCalls).toHaveLength(1)
        expect(billingServiceSpy.constructCalls[0]!.rawBody).toBe(rawBody)
        expect(billingServiceSpy.constructCalls[0]!.signature).toBe('sig_header_value')
      })
    })

    // ── Replay protection ─────────────────────

    describe('replay protection', () => {
      it('should return 400 when event timestamp is older than 5 minutes', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        const fiveMinutesAndOneSecAgo = Math.floor(Date.now() / 1000) - 301
        billingServiceSpy.event = makeEvent({ created: fiveMinutesAndOneSecAgo })

        // Act
        const res = await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })

        // Assert
        expect(res.status).toBe(400)
        const body = (await res.json()) as { error: { code: string } }
        expect(body.error.code).toBe('REPLAY_DETECTED')
      })

      it('should accept event within 5 minute window', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        const fourMinutesAgo = Math.floor(Date.now() / 1000) - 240
        billingServiceSpy.event = makeEvent({ created: fourMinutesAgo })

        // Act
        const res = await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })

        // Assert
        expect(res.status).toBe(200)
        const body = (await res.json()) as { received: boolean }
        expect(body.received).toBe(true)
      })

      it('should accept event at exactly 5 minutes (boundary: 300s)', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        const exactlyFiveMinutes = Math.floor(Date.now() / 1000) - 300
        billingServiceSpy.event = makeEvent({ created: exactlyFiveMinutes })

        // Act
        const res = await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })

        // Assert
        expect(res.status).toBe(200)
      })
    })

    // ── Idempotency ───────────────────────────

    describe('idempotency', () => {
      it('should process same event only once', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        const event = makeEvent({
          id: 'evt_idempotent_test',
          type: 'invoice.payment_succeeded',
          data: {
            object: {
              customer: 'cus_1',
              subscription: 'sub_1',
              metadata: { tenantId: 'tenant-1', planName: 'business' },
            },
          },
        })
        billingServiceSpy.event = event

        // Act — first call
        const res1 = await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })
        // Act — second call (same event id)
        const res2 = await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })

        // Assert
        expect(res1.status).toBe(200)
        expect(res2.status).toBe(200)
        // Handler should only be called once
        expect(billingServiceSpy.paymentSucceededCalls).toHaveLength(1)
      })

      it('should return 200 for duplicate event without calling handlers again', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        const event = makeEvent({
          id: 'evt_dup_test',
          type: 'invoice.payment_failed',
          data: {
            object: {
              customer: 'cus_1',
              subscription: 'sub_1',
              metadata: { tenantId: 'tenant-1', planName: 'starter' },
            },
          },
        })
        billingServiceSpy.event = event

        // Act
        await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })
        const res = await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })

        // Assert
        expect(res.status).toBe(200)
        const body = (await res.json()) as { received: boolean }
        expect(body.received).toBe(true)
        expect(billingServiceSpy.paymentFailedCalls).toHaveLength(1)
      })
    })

    // ── Event routing ─────────────────────────

    describe('event routing', () => {
      it('should route checkout.session.completed to handleCheckoutCompleted', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        billingServiceSpy.event = makeEvent({
          type: 'checkout.session.completed',
          data: {
            object: {
              customer: 'cus_checkout',
              subscription: 'sub_checkout',
              metadata: { tenantId: 'tenant-abc', planName: 'elite' },
            },
          },
        })

        // Act
        const res = await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })

        // Assert
        expect(res.status).toBe(200)
        expect(billingServiceSpy.checkoutCompletedCalls).toHaveLength(1)
        expect(billingServiceSpy.checkoutCompletedCalls[0]).toEqual({
          tenantId: 'tenant-abc',
          customerId: 'cus_checkout',
          subscriptionId: 'sub_checkout',
          planName: 'elite',
        })
      })

      it('should route invoice.payment_succeeded to handlePaymentSucceeded', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        billingServiceSpy.event = makeEvent({
          type: 'invoice.payment_succeeded',
          data: {
            object: {
              customer: 'cus_1',
              subscription: 'sub_1',
              metadata: { tenantId: 'tenant-pay', planName: 'business' },
            },
          },
        })

        // Act
        const res = await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })

        // Assert
        expect(res.status).toBe(200)
        expect(billingServiceSpy.paymentSucceededCalls).toEqual(['tenant-pay'])
      })

      it('should route invoice.payment_failed to handlePaymentFailed', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        billingServiceSpy.event = makeEvent({
          type: 'invoice.payment_failed',
          data: {
            object: {
              customer: 'cus_1',
              subscription: 'sub_1',
              metadata: { tenantId: 'tenant-fail', planName: 'starter' },
            },
          },
        })

        // Act
        const res = await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })

        // Assert
        expect(res.status).toBe(200)
        expect(billingServiceSpy.paymentFailedCalls).toEqual(['tenant-fail'])
      })

      it('should route customer.subscription.deleted to handleSubscriptionDeleted', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        billingServiceSpy.event = makeEvent({
          type: 'customer.subscription.deleted',
          data: {
            object: {
              customer: 'cus_1',
              subscription: 'sub_1',
              metadata: { tenantId: 'tenant-del', planName: 'business' },
            },
          },
        })

        // Act
        const res = await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })

        // Assert
        expect(res.status).toBe(200)
        expect(billingServiceSpy.subscriptionDeletedCalls).toEqual(['tenant-del'])
      })

      it('should acknowledge unhandled event types without calling any handler', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        billingServiceSpy.event = makeEvent({
          type: 'payment_intent.created',
        })

        // Act
        const res = await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })

        // Assert
        expect(res.status).toBe(200)
        const body = (await res.json()) as { received: boolean }
        expect(body.received).toBe(true)
        expect(billingServiceSpy.checkoutCompletedCalls).toHaveLength(0)
        expect(billingServiceSpy.paymentSucceededCalls).toHaveLength(0)
        expect(billingServiceSpy.paymentFailedCalls).toHaveLength(0)
        expect(billingServiceSpy.subscriptionDeletedCalls).toHaveLength(0)
      })
    })

    // ── Missing tenantId ──────────────────────

    describe('missing tenantId in metadata', () => {
      it('should not call handler when tenantId is missing from checkout metadata', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        billingServiceSpy.event = makeEvent({
          type: 'checkout.session.completed',
          data: {
            object: {
              customer: 'cus_1',
              subscription: 'sub_1',
              metadata: {} as Record<string, string>,
            },
          },
        })

        // Act
        const res = await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })

        // Assert
        expect(res.status).toBe(200)
        const body = (await res.json()) as { received: boolean }
        expect(body.received).toBe(true)
        expect(billingServiceSpy.checkoutCompletedCalls).toHaveLength(0)
      })

      it('should not call handler when tenantId is missing from payment_succeeded metadata', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        billingServiceSpy.event = makeEvent({
          type: 'invoice.payment_succeeded',
          data: {
            object: {
              customer: 'cus_1',
              subscription: 'sub_1',
              metadata: {} as Record<string, string>,
            },
          },
        })

        // Act
        const res = await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })

        // Assert
        expect(res.status).toBe(200)
        expect(billingServiceSpy.paymentSucceededCalls).toHaveLength(0)
      })

      it('should not call handler when tenantId is missing from payment_failed metadata', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        billingServiceSpy.event = makeEvent({
          type: 'invoice.payment_failed',
          data: {
            object: {
              customer: 'cus_1',
              subscription: 'sub_1',
              metadata: {} as Record<string, string>,
            },
          },
        })

        // Act
        const res = await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })

        // Assert
        expect(res.status).toBe(200)
        expect(billingServiceSpy.paymentFailedCalls).toHaveLength(0)
      })

      it('should not call handler when tenantId is missing from subscription_deleted metadata', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        billingServiceSpy.event = makeEvent({
          type: 'customer.subscription.deleted',
          data: {
            object: {
              customer: 'cus_1',
              subscription: 'sub_1',
              metadata: {} as Record<string, string>,
            },
          },
        })

        // Act
        const res = await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })

        // Assert
        expect(res.status).toBe(200)
        expect(billingServiceSpy.subscriptionDeletedCalls).toHaveLength(0)
      })
    })

    // ── Checkout completed details ────────────

    describe('checkout.session.completed details', () => {
      it('should default planName to starter when metadata.planName is missing', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        billingServiceSpy.event = makeEvent({
          type: 'checkout.session.completed',
          data: {
            object: {
              customer: 'cus_1',
              subscription: 'sub_1',
              metadata: { tenantId: 'tenant-1' } as Record<string, string>,
            },
          },
        })

        // Act
        await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })

        // Assert
        expect(billingServiceSpy.checkoutCompletedCalls[0]!.planName).toBe('starter')
      })

      it('should pass customer and subscription from event data', async () => {
        // Arrange
        const { app, billingServiceSpy } = sut
        billingServiceSpy.event = makeEvent({
          type: 'checkout.session.completed',
          data: {
            object: {
              customer: 'cus_stripe_abc',
              subscription: 'sub_stripe_xyz',
              metadata: { tenantId: 'tenant-2', planName: 'elite' },
            },
          },
        })

        // Act
        await postWebhook(app, { 'Stripe-Signature': 'valid_sig' })

        // Assert
        const call = billingServiceSpy.checkoutCompletedCalls[0]!
        expect(call.customerId).toBe('cus_stripe_abc')
        expect(call.subscriptionId).toBe('sub_stripe_xyz')
        expect(call.tenantId).toBe('tenant-2')
        expect(call.planName).toBe('elite')
      })
    })
  })
})
