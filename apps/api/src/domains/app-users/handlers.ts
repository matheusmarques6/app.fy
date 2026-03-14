import type { Dependencies } from '@appfy/core'
import { normalizePagination } from '@appfy/core'
import type { Context } from 'hono'
import type { CreateAppUserBody, UpdateAppUserBody, UpdatePushOptInBody } from './schemas.js'

export function createAppUserHandlers(deps: Dependencies) {
  return {
    /** POST /app-users — Register app user */
    async register(c: Context) {
      const tenantId = c.get('tenantId') as string
      const body = c.get('validatedBody' as never) as CreateAppUserBody

      const appUser = await deps.appUserService.register(tenantId, {
        ...(body.externalId !== undefined && { userIdExternal: body.externalId }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.name !== undefined && { name: body.name }),
      })

      return c.json({ data: appUser }, 201)
    },

    /** GET /app-users — List (paginated) */
    async list(c: Context) {
      const tenantId = c.get('tenantId') as string
      const page = Number(c.req.query('page') ?? '1')
      const perPage = Number(c.req.query('limit') ?? '20')
      const pagination = normalizePagination({ page, perPage })

      const result = await deps.appUserService.list(tenantId, pagination)
      return c.json(result)
    },

    /** GET /app-users/:id — Detail */
    async getById(c: Context) {
      const tenantId = c.get('tenantId') as string
      const id = c.req.param('id')!
      const appUser = await deps.appUserService.findById(tenantId, id)
      return c.json({ data: appUser })
    },

    /** PUT /app-users/:id — Update */
    async update(c: Context) {
      const tenantId = c.get('tenantId') as string
      const id = c.req.param('id')!
      const body = c.get('validatedBody' as never) as UpdateAppUserBody

      const updated = await deps.appUserService.update(tenantId, id, {
        ...(body.email !== undefined && { email: body.email }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.pushOptIn !== undefined && { pushOptIn: body.pushOptIn }),
      })

      return c.json({ data: updated })
    },

    /** PATCH /app-users/:id/push-opt-in — Update push opt-in/opt-out (LGPD) */
    async updatePushOptIn(c: Context) {
      const tenantId = c.get('tenantId') as string
      const id = c.req.param('id')!
      const body = c.get('validatedBody' as never) as UpdatePushOptInBody

      await deps.lgpdService.updatePushOptIn(tenantId, id, body.optIn)
      return c.json({ success: true })
    },

    /** DELETE /app-users/:id/data — Delete all user data (LGPD right to be forgotten) */
    async deleteUserData(c: Context) {
      const tenantId = c.get('tenantId') as string
      const id = c.req.param('id')!

      const result = await deps.lgpdService.deleteUserData(tenantId, id)
      return c.json({ data: result })
    },
  }
}
