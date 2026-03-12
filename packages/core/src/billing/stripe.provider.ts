import { BillingError } from '../errors.js'

/**
 * Stripe provider — handles direct Stripe API interactions.
 * Stub — real implementation during TDD with stripe SDK.
 */
export class StripeProvider {
  private readonly secretKey: string

  constructor(secretKey: string) {
    this.secretKey = secretKey
  }

  async createCheckoutSession(
    _customerId: string,
    _priceId: string,
    _successUrl: string,
    _cancelUrl: string,
  ): Promise<{ sessionId: string; url: string }> {
    void this.secretKey
    throw new BillingError('Not implemented')
  }

  async getSubscription(_subscriptionId: string): Promise<unknown> {
    throw new BillingError('Not implemented')
  }

  async cancelSubscription(_subscriptionId: string): Promise<void> {
    throw new BillingError('Not implemented')
  }
}
