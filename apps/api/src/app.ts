import type { Dependencies } from '@appfy/core'
import { Hono } from 'hono'
import { createAnalyticsRoutes } from './domains/analytics/routes.js'
import { createAppConfigRoutes } from './domains/app-configs/routes.js'
import { createAuditLogRoutes } from './domains/audit-logs/routes.js'
import { createAppUserRoutes } from './domains/app-users/routes.js'
import { createAuthRoutes } from './domains/auth/routes.js'
import { createAutomationRoutes } from './domains/automations/routes.js'
import { createBillingRoutes } from './domains/billing/routes.js'
import { createDeviceRoutes } from './domains/devices/routes.js'
import { createEventRoutes } from './domains/events/routes.js'
import { createIntegrationRoutes } from './domains/integrations/routes.js'
import { createNotificationRoutes } from './domains/notifications/routes.js'
import { createSegmentRoutes } from './domains/segments/routes.js'
import { createTenantRoutes } from './domains/tenants/routes.js'
import { errorHandler } from './middleware/error-handler.js'
import { requestLogger } from './middleware/request-logger.js'

export function createApp(deps: Dependencies) {
  const app = new Hono()

  // Global middleware
  app.use('*', requestLogger)
  app.onError(errorHandler)

  // Health check (no auth)
  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  })

  // Mount domain routes under /api prefix
  const api = new Hono()

  api.route('/auth', createAuthRoutes(deps))
  api.route('/tenants', createTenantRoutes(deps))
  api.route('/notifications', createNotificationRoutes(deps))
  api.route('/app-users', createAppUserRoutes(deps))
  api.route('/devices', createDeviceRoutes(deps))
  api.route('/automations', createAutomationRoutes(deps))
  api.route('/segments', createSegmentRoutes(deps))
  api.route('/analytics', createAnalyticsRoutes(deps))
  api.route('/billing', createBillingRoutes(deps))
  api.route('/integrations', createIntegrationRoutes(deps))
  api.route('/app-configs', createAppConfigRoutes(deps))
  api.route('/events', createEventRoutes(deps))
  api.route('/audit-logs', createAuditLogRoutes(deps))

  app.route('/api', api)

  return app
}
