import type { Dependencies } from '@appfy/core'
import { normalizePagination } from '@appfy/core'
import type { NotificationStatus } from '@appfy/shared'
import type { Context } from 'hono'
import type { CreateNotificationBody } from './schemas.js'

export function createNotificationHandlers(deps: Dependencies) {
  return {
    /** GET /notifications — List (paginated, filterable) */
    async list(c: Context) {
      const tenantId = c.get('tenantId') as string
      const page = Number(c.req.query('page') ?? '1')
      const perPage = Number(c.req.query('limit') ?? '20')
      const status = c.req.query('status') as NotificationStatus | undefined
      const type = c.req.query('type')
      const pagination = normalizePagination({ page, perPage })

      const result = await deps.notificationService.list(tenantId, pagination, {
        ...(status !== undefined && { status }),
        ...(type !== undefined && { type }),
      })
      return c.json(result)
    },

    /** POST /notifications — Create manual notification (editor+) */
    async create(c: Context) {
      const tenantId = c.get('tenantId') as string
      const userId = c.get('userId') as string
      const body = c.get('validatedBody' as never) as CreateNotificationBody

      const notification = await deps.notificationService.create(tenantId, {
        title: body.title,
        body: body.body,
        type: body.type,
        createdBy: userId,
      })
      return c.json({ data: notification }, 201)
    },

    /** GET /notifications/:id — Detail with metrics */
    async getById(c: Context) {
      const tenantId = c.get('tenantId') as string
      const id = c.req.param('id')!
      const notification = await deps.notificationService.getById(tenantId, id)
      return c.json({ data: notification })
    },

    /** DELETE /notifications/:id — Delete (owner only) */
    async remove(c: Context) {
      const tenantId = c.get('tenantId') as string
      const id = c.req.param('id')!
      await deps.notificationService.delete(tenantId, id)
      return c.json({ data: { id, deleted: true } })
    },
  }
}
