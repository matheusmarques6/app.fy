import type { Dependencies } from '@appfy/core'
import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { createAuthHandlers } from './handlers.js'
import { switchTenantSchema } from './schemas.js'

export function createAuthRoutes(deps: Dependencies) {
  const app = new Hono()
  const handlers = createAuthHandlers(deps)

  // Auth routes only need JWT auth, no tenant middleware
  app.post('/switch-tenant', authMiddleware, validate(switchTenantSchema), handlers.switchTenant)

  return app
}
