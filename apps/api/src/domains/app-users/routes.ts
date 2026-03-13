import type { Dependencies } from '@appfy/core'
import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { createTenantMiddleware } from '../../middleware/tenant.js'
import { createAppUserHandlers } from './handlers.js'

export function createAppUserRoutes(deps: Dependencies) {
  const app = new Hono()
  const handlers = createAppUserHandlers(deps)
  const tenantMw = createTenantMiddleware(deps)

  // All app-user routes require auth + tenant, read-only (all roles)
  app.use('/*', authMiddleware, tenantMw)

  app.get('/', handlers.list)
  app.get('/:id', handlers.getById)

  return app
}
