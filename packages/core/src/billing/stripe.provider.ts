import { BillingError } from '../errors.js'

/** Minimal interface for Stripe SDK methods we need — avoids direct SDK dependency */
export interface StripeClient {
  checkout: {
    sessions: {
      create(params: {
        customer: string
        line_items: Array<{ price: string; quantity: number }>
        mode: 'subscription'
        success_url: string
        cancel_url: string
      }): Promise<{ id: string; url: string | null }>
    }
  }
  billingPortal: {
    sessions: {
      create(params: {
        customer: string
        return_url: string
      }): Promise<{ url: string }>
    }
  }
  subscriptions: {
    retrieve(id: string): Promise<{
      id: string
      status: string
      current_period_end: number
      items: { data: Array<{ id: string; price: { id: string; product: string } }> }
    }>
    cancel(id: string): Promise<unknown>
    update(id: string, params: { items: Array<{ id: string; price: string }> }): Promise<{
      id: string
      status: string
      current_period_end: number
      items: { data: Array<{ id: string; price: { id: string } }> }
    }>
  }
  webhooks: {
    constructEvent(payload: string, sig: string, secret: string): {
      id: string
      type: string
      data: { object: Record<string, unknown> }
      created: number
    }
  }
}

export interface StripeCheckoutResult {
  readonly sessionId: string
  readonly url: string
}

export interface StripeSubscription {
  readonly id: string
  readonly status: string
  readonly currentPeriodEnd: number
  readonly items: Array<{ id: string; priceId: string }>
}

/**
 * Stripe provider — wraps Stripe SDK interactions.
 * Accepts a StripeClient interface to avoid direct SDK dependency.
 */
export class StripeProvider {
  constructor(private readonly client: StripeClient) {}

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<StripeCheckoutResult> {
    const session = await this.client.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    if (!session.url) {
      throw new BillingError('Stripe checkout session created without URL')
    }

    return { sessionId: session.id, url: session.url }
  }

  async createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    const session = await this.client.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
    return { url: session.url }
  }

  async getSubscription(subscriptionId: string): Promise<StripeSubscription> {
    const sub = await this.client.subscriptions.retrieve(subscriptionId)
    return {
      id: sub.id,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      items: sub.items.data.map((item) => ({ id: item.id, priceId: item.price.id })),
    }
  }

  async updateSubscription(
    subscriptionId: string,
    itemId: string,
    newPriceId: string,
  ): Promise<StripeSubscription> {
    const sub = await this.client.subscriptions.update(subscriptionId, {
      items: [{ id: itemId, price: newPriceId }],
    })
    return {
      id: sub.id,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      items: sub.items.data.map((item) => ({ id: item.id, priceId: item.price.id })),
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.client.subscriptions.cancel(subscriptionId)
  }

  constructWebhookEvent(rawBody: string, signature: string, webhookSecret: string) {
    return this.client.webhooks.constructEvent(rawBody, signature, webhookSecret)
  }
}
