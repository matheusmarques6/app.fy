import type { Dependencies } from '@appfy/core'
import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import { createTenantMiddleware } from '../../middleware/tenant.js'
import { validate } from '../../middleware/validate.js'
import { createIntegrationHandlers } from './handlers.js'
import { connectSchema } from './schemas.js'

export function createIntegrationRoutes(deps: Dependencies) {
  const app = new Hono()
  const handlers = createIntegrationHandlers(deps)
  const tenantMw = createTenantMiddleware(deps)

  // Webhook and OAuth callback have NO auth — use HMAC verification
  app.post('/:platform/webhook', handlers.webhook)
  app.get('/:platform/callback', handlers.callback)

  // List and connect require auth + tenant
  app.get('/', authMiddleware, tenantMw, handlers.list)
  app.post(
    '/:platform/connect',
    authMiddleware,
    tenantMw,
    requireRoles('owner', 'editor'),
    validate(connectSchema),
    handlers.connect,
  )

  return app
}
