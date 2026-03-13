import type { Dependencies } from '@appfy/core'
import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import { createTenantMiddleware } from '../../middleware/tenant.js'
import { validate } from '../../middleware/validate.js'
import { createTenantHandlers } from './handlers.js'
import { createTenantSchema, updateTenantSchema } from './schemas.js'

export function createTenantRoutes(deps: Dependencies) {
  const app = new Hono()
  const handlers = createTenantHandlers(deps)
  const tenantMw = createTenantMiddleware(deps)

  // List tenants only needs auth (no tenant context yet)
  app.get('/', authMiddleware, handlers.list)

  // Create tenant only needs auth
  app.post('/', authMiddleware, validate(createTenantSchema), handlers.create)

  // These need tenant context
  app.get('/:id', authMiddleware, tenantMw, handlers.getById)
  app.put('/:id', authMiddleware, tenantMw, requireRoles('owner'), validate(updateTenantSchema), handlers.update)

  return app
}
