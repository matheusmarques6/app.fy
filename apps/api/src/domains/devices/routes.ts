import type { Dependencies } from '@appfy/core'
import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import { createTenantMiddleware } from '../../middleware/tenant.js'
import { validate } from '../../middleware/validate.js'
import { createDeviceHandlers } from './handlers.js'
import { registerDeviceSchema } from './schemas.js'

export function createDeviceRoutes(deps: Dependencies) {
  const app = new Hono()
  const handlers = createDeviceHandlers(deps)
  const tenantMw = createTenantMiddleware(deps)

  // All device routes require auth + tenant
  app.use('/*', authMiddleware, tenantMw)

  app.get('/', handlers.list)
  app.post('/', requireRoles('owner', 'editor'), validate(registerDeviceSchema), handlers.register)

  return app
}
