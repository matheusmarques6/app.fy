import { BillingError } from '../errors.js'

/** Checkout session returned by Stripe */
export interface CheckoutSession {
  readonly sessionId: string
  readonly url: string
}

/** Subscription details */
export interface Subscription {
  readonly id: string
  readonly tenantId: string
  readonly planName: string
  readonly status: 'active' | 'past_due' | 'canceled' | 'trialing'
  readonly currentPeriodEnd: Date
}

/** Stripe webhook event payload */
export interface BillingWebhookEvent {
  readonly type: string
  readonly data: unknown
}

export class BillingService {
  private readonly stripeSecretKey: string

  constructor(stripeSecretKey: string) {
    this.stripeSecretKey = stripeSecretKey
  }

  async createCheckout(_tenantId: string, _planName: string): Promise<CheckoutSession> {
    void this.stripeSecretKey
    throw new BillingError('Not implemented')
  }

  async handleWebhook(_event: BillingWebhookEvent): Promise<void> {
    throw new BillingError('Not implemented')
  }

  async getSubscription(_tenantId: string): Promise<Subscription | undefined> {
    throw new BillingError('Not implemented')
  }
}
