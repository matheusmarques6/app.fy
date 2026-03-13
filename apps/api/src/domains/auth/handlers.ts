import type { Dependencies } from '@appfy/core'
import type { Context } from 'hono'
import type { SwitchTenantBody } from './schemas.js'

export function createAuthHandlers(deps: Dependencies) {
  return {
    /**
     * POST /auth/switch-tenant
     * Takes { tenantId }, validates membership, returns new JWT with tenant_id + role.
     */
    async switchTenant(c: Context) {
      // userId will be used when MembershipRepository is wired
      void c.get('userId')
      const body = c.get('validatedBody' as never) as SwitchTenantBody

      // Validate tenant exists
      const tenant = await deps.tenantService.findById(body.tenantId)
      if (!tenant) {
        return c.json(
          { error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' } },
          404,
        )
      }

      // TODO: Validate membership and get role via MembershipRepository
      // TODO: Sign new JWT with tenant_id + role using jose
      return c.json({
        data: {
          accessToken: 'TODO_SIGNED_JWT',
          tenantId: body.tenantId,
          role: 'owner',
        },
      })
    },
  }
}
