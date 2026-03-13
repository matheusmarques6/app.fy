import type { Dependencies } from '@appfy/core'
import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { createTenantMiddleware } from '../../middleware/tenant.js'
import { createAnalyticsHandlers } from './handlers.js'

export function createAnalyticsRoutes(deps: Dependencies) {
  const app = new Hono()
  const handlers = createAnalyticsHandlers(deps)
  const tenantMw = createTenantMiddleware(deps)

  // All analytics routes require auth + tenant, read-only (all roles)
  app.use('/*', authMiddleware, tenantMw)

  app.get('/overview', handlers.overview)
  app.get('/notifications/:id', handlers.notificationMetrics)
  app.get('/flows', handlers.flowMetrics)

  return app
}
