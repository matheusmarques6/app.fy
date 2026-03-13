import { TenantNotFoundError, type Dependencies } from '@appfy/core'
import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

/**
 * Creates tenant middleware that validates X-Tenant-Id header
 * and verifies user membership via the provided dependencies.
 */
export function createTenantMiddleware(deps: Dependencies): MiddlewareHandler {
  return async (c, next) => {
    const tenantId = c.req.header('X-Tenant-Id')
    if (!tenantId) {
      throw new HTTPException(400, { message: 'Missing X-Tenant-Id header' })
    }

    const userId = c.get('userId')

    try {
      await deps.tenantService.findById(tenantId)
    } catch (err) {
      if (err instanceof TenantNotFoundError) {
        throw new HTTPException(403, { message: 'Tenant not found or access denied' })
      }
      throw err
    }

    const membership = await deps.membershipRepo.findByUserAndTenant(tenantId, userId)
    if (!membership) {
      throw new HTTPException(403, { message: 'Tenant not found or access denied' })
    }

    c.set('tenantId', tenantId)
    c.set('userRole', membership.role)

    await next()
  }
}
