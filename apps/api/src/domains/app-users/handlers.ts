import type { Dependencies } from '@appfy/core'
import { normalizePagination } from '@appfy/core'
import type { Context } from 'hono'

export function createAppUserHandlers(deps: Dependencies) {
  return {
    /** GET /app-users — List (paginated) */
    async list(c: Context) {
      const tenantId = c.get('tenantId') as string
      const page = Number(c.req.query('page') ?? '1')
      const perPage = Number(c.req.query('limit') ?? '20')
      const pagination = normalizePagination({ page, perPage })

      const result = await deps.appUserService.list(tenantId, pagination)
      return c.json(result)
    },

    /** GET /app-users/:id — Detail with events timeline */
    async getById(c: Context) {
      const tenantId = c.get('tenantId') as string
      const id = c.req.param('id')!
      const appUser = await deps.appUserService.findById(tenantId, id)
      return c.json({ data: appUser })
    },
  }
}
