import type { Dependencies } from '@appfy/core'
import { normalizePagination } from '@appfy/core'
import type { SegmentRuleGroup } from '@appfy/core'
import type { Context } from 'hono'
import type { CreateSegmentBody, UpdateSegmentBody } from './schemas.js'

/** Convert Zod-parsed rules (value?: unknown) to domain SegmentRuleGroup (value: unknown) */
function toSegmentRules(rules: CreateSegmentBody['rules']): SegmentRuleGroup {
  return {
    operator: rules.operator,
    conditions: rules.conditions.map((c) => ({
      field: c.field,
      op: c.op,
      value: c.value as unknown,
    })),
  }
}

export function createSegmentHandlers(deps: Dependencies) {
  return {
    /** POST /segments — Create segment */
    async create(c: Context) {
      const tenantId = c.get('tenantId') as string
      const body = c.get('validatedBody' as never) as CreateSegmentBody

      const segment = await deps.segmentService.create(tenantId, {
        name: body.name,
        ...(body.description !== undefined && { description: body.description }),
        rules: toSegmentRules(body.rules),
      })
      return c.json({ data: segment }, 201)
    },

    /** GET /segments — List segments */
    async list(c: Context) {
      const tenantId = c.get('tenantId') as string
      const page = Number(c.req.query('page') ?? '1')
      const perPage = Number(c.req.query('limit') ?? '20')
      const pagination = normalizePagination({ page, perPage })

      const result = await deps.segmentService.list(tenantId, pagination)
      return c.json(result)
    },

    /** GET /segments/:id — Segment detail */
    async getById(c: Context) {
      const tenantId = c.get('tenantId') as string
      const id = c.req.param('id')!
      const segment = await deps.segmentService.findById(tenantId, id)
      return c.json({ data: segment })
    },

    /** PUT /segments/:id — Update segment */
    async update(c: Context) {
      const tenantId = c.get('tenantId') as string
      const id = c.req.param('id')!
      const body = c.get('validatedBody' as never) as UpdateSegmentBody

      const updated = await deps.segmentService.update(tenantId, id, {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.rules !== undefined && { rules: toSegmentRules(body.rules) }),
      })
      return c.json({ data: updated })
    },

    /** DELETE /segments/:id — Delete segment */
    async remove(c: Context) {
      const tenantId = c.get('tenantId') as string
      const id = c.req.param('id')!
      await deps.segmentService.delete(tenantId, id)
      return c.json({ data: { id, deleted: true } })
    },

    /** GET /segments/:id/members — Get segment members */
    async members(c: Context) {
      const tenantId = c.get('tenantId') as string
      const id = c.req.param('id')!
      const page = Number(c.req.query('page') ?? '1')
      const perPage = Number(c.req.query('limit') ?? '20')
      const pagination = normalizePagination({ page, perPage })

      const result = await deps.segmentService.getMembers(tenantId, id, pagination)
      return c.json(result)
    },
  }
}
