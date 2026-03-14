import type { Dependencies } from '@appfy/core'
import { normalizePagination } from '@appfy/core'
import type { Context } from 'hono'

export function createAuditLogHandlers(deps: Dependencies) {
  return {
    /** GET /audit-logs — List (paginated, owner only) */
    async list(c: Context) {
      const tenantId = c.get('tenantId') as string
      const page = Number(c.req.query('page') ?? '1')
      const perPage = Number(c.req.query('limit') ?? '20')
      const pagination = normalizePagination({ page, perPage })

      const result = await deps.auditLogService.list(tenantId, pagination)
      return c.json(result)
    },

    /** GET /audit-logs/:id — Detail */
    async getById(c: Context) {
      const tenantId = c.get('tenantId') as string
      const id = c.req.param('id')!
      const entry = await deps.auditLogService.getById(tenantId, id)
      if (!entry) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Audit log entry not found' } }, 404)
      }
      return c.json({ data: entry })
    },
  }
}
