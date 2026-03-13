import type { Dependencies } from '@appfy/core'
import { slugify } from '@appfy/shared'
import type { Context } from 'hono'
import type { CreateTenantBody, UpdateTenantBody } from './schemas.js'

export function createTenantHandlers(deps: Dependencies) {
  return {
    /** GET /tenants — List user's tenants (via memberships) */
    async list(c: Context) {
      // userId will be used when MembershipRepository is wired
      void c.get('userId')
      // TODO: List tenants via MembershipRepository for userId
      return c.json({ data: [] })
    },

    /** GET /tenants/:id — Get tenant detail */
    async getById(c: Context) {
      const tenantId = c.get('tenantId') as string
      const tenant = await deps.tenantService.findById(tenantId)
      return c.json({ data: tenant })
    },

    /** PUT /tenants/:id — Update tenant (owner only) */
    async update(c: Context) {
      const tenantId = c.get('tenantId') as string
      const body = c.get('validatedBody' as never) as UpdateTenantBody
      const input: Record<string, unknown> = {}
      if (body.name !== undefined) {
        input.name = body.name
      }
      const updated = await deps.tenantService.update(tenantId, input as Parameters<typeof deps.tenantService.update>[1])
      return c.json({ data: updated })
    },

    /** POST /tenants — Create tenant */
    async create(c: Context) {
      // userId will be used to create membership after tenant creation
      void c.get('userId')
      const body = c.get('validatedBody' as never) as CreateTenantBody
      const slug = slugify(body.name)
      const tenant = await deps.tenantService.create('system', {
        name: body.name,
        slug,
        platform: body.platform,
      })
      return c.json({ data: tenant }, 201)
    },
  }
}
