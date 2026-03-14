import type { Dependencies } from '@appfy/core'
import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import { createTenantMiddleware } from '../../middleware/tenant.js'
import { validate } from '../../middleware/validate.js'
import { createBillingHandlers } from './handlers.js'
import { checkoutSchema, portalSchema } from './schemas.js'

export function createBillingRoutes(deps: Dependencies) {
  const app = new Hono()
  const handlers = createBillingHandlers(deps)
  const tenantMw = createTenantMiddleware(deps)

  // Webhook has NO auth — uses Stripe signature verification
  app.post('/webhook', handlers.webhook)

  // Checkout and portal are owner-only
  app.post('/checkout', authMiddleware, tenantMw, requireRoles('owner'), validate(checkoutSchema), handlers.checkout)
  app.post('/portal', authMiddleware, tenantMw, requireRoles('owner'), validate(portalSchema), handlers.portal)

  // Subscription details — any authenticated member can view
  app.get('/subscription', authMiddleware, tenantMw, handlers.subscription)

  return app
}
