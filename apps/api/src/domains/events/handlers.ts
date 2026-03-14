import type { Dependencies } from '@appfy/core'
import type { AppEventType } from '@appfy/shared'
import type { Context } from 'hono'
import type { IngestEventBody } from './schemas.js'
import { listEventsSchema } from './schemas.js'

export function createEventHandlers(deps: Dependencies) {
  return {
    /** POST /events — Ingest app event */
    async ingest(c: Context) {
      const tenantId = c.get('tenantId') as string
      const body = c.get('validatedBody' as never) as IngestEventBody

      const event = await deps.eventIngestionService.ingest(tenantId, {
        appUserId: body.appUserId,
        eventType: body.eventType,
        ...(body.properties !== undefined && { properties: body.properties }),
      })

      if (!event) {
        return c.json({ data: null, message: 'Duplicate event rejected' }, 200)
      }

      return c.json({ data: event }, 201)
    },

    /** GET /events — List events (paginated, filterable) */
    async list(c: Context) {
      const tenantId = c.get('tenantId') as string

      const parsed = listEventsSchema.safeParse({
        page: c.req.query('page'),
        limit: c.req.query('limit'),
        eventType: c.req.query('eventType'),
        appUserId: c.req.query('appUserId'),
      })

      const filters = parsed.success
        ? {
            ...(parsed.data.eventType && { eventType: parsed.data.eventType as AppEventType }),
            ...(parsed.data.appUserId && { appUserId: parsed.data.appUserId }),
          }
        : {}

      const result = await deps.eventRepo.list(tenantId, filters)
      return c.json(result)
    },
  }
}
