import type { Dependencies } from '@appfy/core'
import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/roles.js'
import { createTenantMiddleware } from '../../middleware/tenant.js'
import { validate } from '../../middleware/validate.js'
import { createAutomationHandlers } from './handlers.js'
import { toggleAutomationSchema, updateAutomationSchema } from './schemas.js'

export function createAutomationRoutes(deps: Dependencies) {
  const app = new Hono()
  const handlers = createAutomationHandlers(deps)
  const tenantMw = createTenantMiddleware(deps)

  // All automation routes require auth + tenant
  app.use('/*', authMiddleware, tenantMw)

  // All roles can read
  app.get('/', handlers.list)
  app.get('/:flowType', handlers.getByFlowType)

  // Editor + owner can update
  app.put('/:flowType', requireRoles('owner', 'editor'), validate(updateAutomationSchema), handlers.update)
  app.patch('/:flowType/toggle', requireRoles('owner', 'editor'), validate(toggleAutomationSchema), handlers.toggle)

  return app
}
