import { z } from 'zod'

const conditionSchema = z.object({
  field: z.string().min(1),
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'not_in']),
  value: z.unknown(),
})

const rulesSchema = z.object({
  operator: z.enum(['AND', 'OR']),
  conditions: z.array(conditionSchema),
})

export const createSegmentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  rules: rulesSchema,
})

export type CreateSegmentBody = z.infer<typeof createSegmentSchema>

export const updateSegmentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  rules: rulesSchema.optional(),
})

export type UpdateSegmentBody = z.infer<typeof updateSegmentSchema>
