import type { Dependencies } from '@appfy/core'
import type { Context } from 'hono'
import type { CheckoutBody, PortalBody } from './schemas.js'

/** Structured logger for webhook events — avoids console.warn in prod */
function logWebhookWarning(eventType: string, eventId: string, message: string): void {
  process.stderr.write(
    `${JSON.stringify({ level: 'warn', message, eventType, eventId })}\n`,
  )
}

/** Extracts tenantId from Stripe event metadata */
function extractTenantId(event: { type: string; id: string; data: { object: unknown } }): {
  tenantId: string | undefined
  obj: Record<string, unknown>
} {
  const obj = event.data.object as Record<string, unknown>
  const tenantId = (obj.metadata as Record<string, string> | undefined)?.tenantId
  if (!tenantId) {
    logWebhookWarning(event.type, event.id, 'Stripe webhook missing tenantId in metadata')
  }
  return { tenantId, obj }
}

export function createBillingHandlers(deps: Dependencies) {
  return {
    /** POST /billing/checkout — Create Stripe checkout session (owner only) */
    async checkout(c: Context) {
      const tenantId = c.get('tenantId') as string
      const body = c.get('validatedBody' as never) as CheckoutBody

      const session = await deps.billingService.createCheckout(
        tenantId,
        body.planName,
        body.successUrl,
        body.cancelUrl,
      )
      return c.json({ data: session })
    },

    /** POST /billing/portal — Create Stripe billing portal session (owner only) */
    async portal(c: Context) {
      const tenantId = c.get('tenantId') as string
      const body = c.get('validatedBody' as never) as PortalBody

      const result = await deps.billingService.createPortalSession(tenantId, body.returnUrl)
      return c.json({ data: result })
    },

    /** GET /billing/subscription — Get current subscription details */
    async subscription(c: Context) {
      const tenantId = c.get('tenantId') as string

      const subscription = await deps.billingService.getSubscription(tenantId)
      if (!subscription) {
        return c.json({ data: null })
      }
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
        const event = deps.billingService.constructWebhookEvent(rawBody, signature)

        // Replay protection: reject events older than 5 minutes
        const eventAge = Math.floor(Date.now() / 1000) - event.created
        if (eventAge > 300) {
          return c.json(
            { error: { code: 'REPLAY_DETECTED', message: 'Event timestamp is too old' } },
            400,
          )
        }

        // Idempotency: skip already-processed events
        if (await deps.idempotencyStore.has(event.id)) {
          return c.json({ received: true })
        }
        await deps.idempotencyStore.add(event.id)

        switch (event.type) {
          case 'checkout.session.completed': {
            const { tenantId, obj } = extractTenantId(event)
            if (!tenantId) break
            await deps.billingService.handleCheckoutCompleted(
              tenantId,
              obj.customer as string,
              obj.subscription as string,
              ((obj.metadata as Record<string, string>)?.planName) ?? 'starter',
            )
            break
          }
          case 'invoice.payment_succeeded': {
            const { tenantId } = extractTenantId(event)
            if (!tenantId) break
            await deps.billingService.handlePaymentSucceeded(tenantId)
            break
          }
          case 'invoice.payment_failed': {
            const { tenantId } = extractTenantId(event)
            if (!tenantId) break
            await deps.billingService.handlePaymentFailed(tenantId)
            break
          }
          case 'customer.subscription.deleted': {
            const { tenantId } = extractTenantId(event)
            if (!tenantId) break
            await deps.billingService.handleSubscriptionDeleted(tenantId)
            break
          }
          default:
            // Unhandled event type — acknowledge receipt
            break
        }

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
