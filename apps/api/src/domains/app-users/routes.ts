import type { Dependencies } from '@appfy/core'
import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import { createTenantMiddleware } from '../../middleware/tenant.js'
import { validate } from '../../middleware/validate.js'
import { createAppUserHandlers } from './handlers.js'
import { createAppUserSchema, updateAppUserSchema, updatePushOptInSchema } from './schemas.js'

export function createAppUserRoutes(deps: Dependencies) {
  const app = new Hono()
  const handlers = createAppUserHandlers(deps)
  const tenantMw = createTenantMiddleware(deps)

  // All app-user routes require auth + tenant
  app.use('/*', authMiddleware, tenantMw)

  // POST — register (editor+)
  app.post('/', requireRoles('owner', 'editor'), validate(createAppUserSchema), handlers.register)

  // GET — list (all roles)
  app.get('/', handlers.list)

  // GET — detail (all roles)
  app.get('/:id', handlers.getById)

  // PUT — update (editor+)
  app.put('/:id', requireRoles('owner', 'editor'), validate(updateAppUserSchema), handlers.update)

  // PATCH — push opt-in/opt-out (editor+, LGPD)
  app.patch('/:id/push-opt-in', requireRoles('owner', 'editor'), validate(updatePushOptInSchema), handlers.updatePushOptIn)

  // DELETE — user data deletion (owner only, LGPD right to be forgotten)
  app.delete('/:id/data', requireRoles('owner'), handlers.deleteUserData)

  return app
}
