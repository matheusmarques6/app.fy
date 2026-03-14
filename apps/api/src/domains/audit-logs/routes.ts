import type { Dependencies } from '@appfy/core'
import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import { createTenantMiddleware } from '../../middleware/tenant.js'
import { createAuditLogHandlers } from './handlers.js'

export function createAuditLogRoutes(deps: Dependencies) {
  const app = new Hono()
  const handlers = createAuditLogHandlers(deps)
  const tenantMw = createTenantMiddleware(deps)

  // All audit log routes require auth + tenant + owner role
  app.use('/*', authMiddleware, tenantMw)

  // Only owner can view audit logs
  app.get('/', requireRoles('owner'), handlers.list)
  app.get('/:id', requireRoles('owner'), handlers.getById)

  return app
}
