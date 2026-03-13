import type { Dependencies } from '@appfy/core'
import type { Context } from 'hono'
import type { CheckoutBody } from './schemas.js'

export function createBillingHandlers(deps: Dependencies) {
  return {
    /** POST /billing/checkout — Create Stripe checkout session (owner only) */
    async checkout(c: Context) {
      const tenantId = c.get('tenantId') as string
      const body = c.get('validatedBody' as never) as CheckoutBody

      const session = await deps.billingService.createCheckout(tenantId, body.planName)
      return c.json({ data: session })
    },

    /** POST /billing/portal — Create Stripe portal session (owner only) */
    async portal(c: Context) {
      const tenantId = c.get('tenantId') as string
      // TODO: BillingService.createPortalSession not yet implemented
      const subscription = await deps.billingService.getSubscription(tenantId)
      return c.json({ data: subscription })
    },

    /** POST /billing/webhook — Stripe webhook handler (no auth) */
    async webhook(c: Context) {
      const signature = c.req.header('Stripe-Signature')
      if (!signature) {
        return c.json(
          { error: { code: 'MISSING_SIGNATURE', message: 'Missing Stripe-Signature header' } },
          400,
        )
      }

      const rawBody = await c.req.text()

      try {
        await deps.billingService.handleWebhook({ type: 'stripe_event', data: JSON.parse(rawBody) })
        return c.json({ received: true })
      } catch {
        return c.json(
          { error: { code: 'WEBHOOK_ERROR', message: 'Invalid webhook signature' } },
          400,
        )
      }
    },
  }
}
