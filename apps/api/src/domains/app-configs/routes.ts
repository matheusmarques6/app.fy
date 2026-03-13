import type { Dependencies } from '@appfy/core'
import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import { createTenantMiddleware } from '../../middleware/tenant.js'
import { validate } from '../../middleware/validate.js'
import { createAppConfigHandlers } from './handlers.js'
import { updateAppConfigSchema } from './schemas.js'

export function createAppConfigRoutes(deps: Dependencies) {
  const app = new Hono()
  const handlers = createAppConfigHandlers(deps)
  const tenantMw = createTenantMiddleware(deps)

  // All app-config routes require auth + tenant
  app.use('/*', authMiddleware, tenantMw)

  // All roles can read
  app.get('/', handlers.get)

  // Editor + owner can update
  app.put('/', requireRoles('owner', 'editor'), validate(updateAppConfigSchema), handlers.update)

  return app
}
