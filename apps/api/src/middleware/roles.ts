import type { MembershipRole } from '@appfy/shared'
import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

/**
 * Factory function returning middleware that checks userRole
 * from context against a list of allowed roles.
 *
 * Usage: app.post('/path', requireRoles('owner', 'editor'), handler)
 */
export function requireRoles(...roles: MembershipRole[]): MiddlewareHandler {
  return async (c, next) => {
    const userRole = c.get('userRole') as MembershipRole | undefined
    if (!userRole) {
      throw new HTTPException(403, { message: 'No role assigned' })
    }

    if (!roles.includes(userRole)) {
      throw new HTTPException(403, {
        message: `Insufficient permissions. Required: ${roles.join(' or ')}`,
      })
    }

    await next()
  }
}
