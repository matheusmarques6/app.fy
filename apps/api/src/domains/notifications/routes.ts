import type { Dependencies } from '@appfy/core'
import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import { createTenantMiddleware } from '../../middleware/tenant.js'
import { validate } from '../../middleware/validate.js'
import { createNotificationHandlers } from './handlers.js'
import { createNotificationSchema } from './schemas.js'

export function createNotificationRoutes(deps: Dependencies) {
  const app = new Hono()
  const handlers = createNotificationHandlers(deps)
  const tenantMw = createTenantMiddleware(deps)

  // All notification routes require auth + tenant
  app.use('/*', authMiddleware, tenantMw)

  // viewer + editor + owner can read
  app.get('/', handlers.list)
  app.get('/:id', handlers.getById)

  // editor + owner can create
  app.post('/', requireRoles('owner', 'editor'), validate(createNotificationSchema), handlers.create)

  // only owner can delete
  app.delete('/:id', requireRoles('owner'), handlers.delete)

  return app
}
