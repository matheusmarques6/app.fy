import { beforeEach, describe, expect, it } from 'vitest'
import { BillingError } from '../errors.js'
import type { StripeClient } from './stripe.provider.js'
import { StripeProvider } from './stripe.provider.js'

function makeStripeClientSpy(): StripeClient & { calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = {}
  const track = (method: string, args: unknown[]) => {
    calls[method] = calls[method] ?? []
    calls[method].push(args)
  }

  return {
    calls,
    checkout: {
      sessions: {
        create: async (params) => {
          track('checkout.sessions.create', [params])
          return { id: 'cs_123', url: 'https://checkout.stripe.com/cs_123' }
        },
      },
    },
    billingPortal: {
      sessions: {
        create: async (params) => {
          track('billingPortal.sessions.create', [params])
          return { url: 'https://billing.stripe.com/portal/sess_123' }
        },
      },
    },
    subscriptions: {
      retrieve: async (id) => {
        track('subscriptions.retrieve', [id])
        return {
          id,
          status: 'active',
          current_period_end: 1700000000,
          items: {
            data: [{ id: 'si_1', price: { id: 'price_starter', product: 'prod_1' } }],
          },
        }
      },
      cancel: async (id) => {
        track('subscriptions.cancel', [id])
        return {}
      },
      update: async (id, params) => {
        track('subscriptions.update', [id, params])
        return {
          id,
          status: 'active',
          current_period_end: 1700000000,
          items: {
            data: [{ id: 'si_1', price: { id: params.items[0]!.price } }],
          },
        }
      },
    },
    webhooks: {
      constructEvent: (payload, sig, secret) => {
        track('webhooks.constructEvent', [payload, sig, secret])
        return {
          id: 'evt_123',
          type: 'checkout.session.completed',
          data: { object: { id: 'cs_123' } },
          created: 1700000000,
        }
      },
    },
  }
}

describe('StripeProvider', () => {
  let stripeClient: ReturnType<typeof makeStripeClientSpy>
  let sut: StripeProvider

  function makeSut() {
    stripeClient = makeStripeClientSpy()
    sut = new StripeProvider(stripeClient)
  }

  beforeEach(() => makeSut())

  describe('createCheckoutSession', () => {
    it('should call stripe with correct params and return session', async () => {
      const result = await sut.createCheckoutSession('cus_1', 'price_starter', 'https://ok', 'https://cancel')

      expect(result).toEqual({ sessionId: 'cs_123', url: 'https://checkout.stripe.com/cs_123' })
      expect(stripeClient.calls['checkout.sessions.create']).toHaveLength(1)
      expect(stripeClient.calls['checkout.sessions.create']![0]![0]).toEqual({
        customer: 'cus_1',
        line_items: [{ price: 'price_starter', quantity: 1 }],
        mode: 'subscription',
        success_url: 'https://ok',
        cancel_url: 'https://cancel',
      })
    })

    it('should throw BillingError when session has no URL', async () => {
      stripeClient.checkout.sessions.create = async () => ({ id: 'cs_123', url: null })

      await expect(
        sut.createCheckoutSession('cus_1', 'price_starter', 'https://ok', 'https://cancel'),
      ).rejects.toThrow(BillingError)
    })
  })

  describe('createPortalSession', () => {
    it('should return portal URL', async () => {
      const result = await sut.createPortalSession('cus_1', 'https://return')

      expect(result.url).toBe('https://billing.stripe.com/portal/sess_123')
      expect(stripeClient.calls['billingPortal.sessions.create']).toHaveLength(1)
      expect(stripeClient.calls['billingPortal.sessions.create']![0]![0]).toEqual({
        customer: 'cus_1',
        return_url: 'https://return',
      })
    })
  })

  describe('getSubscription', () => {
    it('should map stripe response to StripeSubscription', async () => {
      const result = await sut.getSubscription('sub_123')

      expect(result).toEqual({
        id: 'sub_123',
        status: 'active',
        currentPeriodEnd: 1700000000,
        items: [{ id: 'si_1', priceId: 'price_starter' }],
      })
      expect(stripeClient.calls['subscriptions.retrieve']).toHaveLength(1)
    })
  })

  describe('updateSubscription', () => {
    it('should call stripe update with correct params', async () => {
      const result = await sut.updateSubscription('sub_123', 'si_1', 'price_business')

      expect(result.items[0]!.priceId).toBe('price_business')
      expect(stripeClient.calls['subscriptions.update']).toHaveLength(1)
      expect(stripeClient.calls['subscriptions.update']![0]).toEqual([
        'sub_123',
        { items: [{ id: 'si_1', price: 'price_business' }] },
      ])
    })
  })

  describe('cancelSubscription', () => {
    it('should call stripe cancel', async () => {
      await sut.cancelSubscription('sub_123')

      expect(stripeClient.calls['subscriptions.cancel']).toHaveLength(1)
      expect(stripeClient.calls['subscriptions.cancel']![0]).toEqual(['sub_123'])
    })
  })

  describe('constructWebhookEvent', () => {
    it('should delegate to stripe.webhooks.constructEvent', () => {
      const result = sut.constructWebhookEvent('payload', 'sig_123', 'whsec_123')

      expect(result).toEqual({
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_123' } },
        created: 1700000000,
      })
      expect(stripeClient.calls['webhooks.constructEvent']).toHaveLength(1)
      expect(stripeClient.calls['webhooks.constructEvent']![0]).toEqual([
        'payload',
        'sig_123',
        'whsec_123',
      ])
    })
  })
})
