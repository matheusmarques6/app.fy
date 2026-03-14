import type { Dependencies } from '@appfy/core'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import * as jose from 'jose'
import { env } from '../../env.js'
import type { SwitchTenantBody } from './schemas.js'

export function createAuthHandlers(deps: Dependencies) {
  return {
    /**
     * POST /auth/switch-tenant
     * Takes { tenantId }, validates membership, returns new JWT with tenant_id + role.
     */
    async switchTenant(c: Context) {
      const userId = c.get('userId') as string
      const body = c.get('validatedBody' as never) as SwitchTenantBody

      // Validate tenant exists
      const tenant = await deps.tenantService.findById(body.tenantId)
      if (!tenant) {
        return c.json(
          { error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' } },
          404,
        )
      }

      // Validate membership and get role
      const membership = await deps.membershipRepo.findByUserAndTenant(body.tenantId, userId)
      if (!membership) {
        throw new HTTPException(403, { message: 'Not a member of this tenant' })
      }

      // Sign new JWT with tenant_id + role
      const secret = new TextEncoder().encode(env.JWT_SECRET)
      const accessToken = await new jose.SignJWT({
        sub: userId,
        tenant_id: body.tenantId,
        role: membership.role,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret)

      return c.json({
        data: {
          accessToken,
          tenantId: body.tenantId,
          role: membership.role,
        },
      })
    },
  }
}
