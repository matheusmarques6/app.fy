import type { Dependencies } from '@appfy/core'
import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import { createTenantMiddleware } from '../../middleware/tenant.js'
import { validate } from '../../middleware/validate.js'
import { createSegmentHandlers } from './handlers.js'
import { createSegmentSchema, updateSegmentSchema } from './schemas.js'

export function createSegmentRoutes(deps: Dependencies) {
  const app = new Hono()
  const handlers = createSegmentHandlers(deps)
  const tenantMw = createTenantMiddleware(deps)

  // All segment routes require auth + tenant
  app.use('/*', authMiddleware, tenantMw)

  // POST — create (editor+)
  app.post('/', requireRoles('owner', 'editor'), validate(createSegmentSchema), handlers.create)

  // GET — list (all roles)
  app.get('/', handlers.list)

  // GET — detail (all roles)
  app.get('/:id', handlers.getById)

  // GET — members (all roles)
  app.get('/:id/members', handlers.members)

  // PUT — update (editor+)
  app.put('/:id', requireRoles('owner', 'editor'), validate(updateSegmentSchema), handlers.update)

  // DELETE — remove (owner only)
  app.delete('/:id', requireRoles('owner'), handlers.remove)

  return app
}
