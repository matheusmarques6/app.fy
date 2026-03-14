import type { Dependencies } from '@appfy/core'
import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import { createTenantMiddleware } from '../../middleware/tenant.js'
import { validate } from '../../middleware/validate.js'
import { createEventHandlers } from './handlers.js'
import { ingestEventSchema } from './schemas.js'

export function createEventRoutes(deps: Dependencies) {
  const app = new Hono()
  const handlers = createEventHandlers(deps)
  const tenantMw = createTenantMiddleware(deps)

  // All event routes require auth + tenant
  app.use('/*', authMiddleware, tenantMw)

  // viewer + editor + owner can list events
  app.get('/', handlers.list)

  // editor + owner can ingest events
  app.post('/', requireRoles('owner', 'editor'), validate(ingestEventSchema), handlers.ingest)

  return app
}
