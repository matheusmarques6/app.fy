import type { StripeClient } from '@appfy/core'

/**
 * No-op Stripe client for workers that don't handle billing.
 * Workers (push, ingestion, analytics) never call Stripe directly —
 * this stub satisfies the FactoryConfig type without adding a real dependency.
 */
export function createNoopStripeClient(): StripeClient {
  const notImplemented = () => {
    throw new Error('Stripe is not available in worker context')
  }

  return {
    checkout: { sessions: { create: notImplemented } },
    billingPortal: { sessions: { create: notImplemented } },
    subscriptions: { retrieve: notImplemented, cancel: notImplemented, update: notImplemented },
    webhooks: { constructEvent: notImplemented },
  }
}
