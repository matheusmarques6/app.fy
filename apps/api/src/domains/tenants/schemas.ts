import { z } from 'zod'

export const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  platform: z.enum(['shopify', 'nuvemshop']),
})

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
})

export type CreateTenantBody = z.infer<typeof createTenantSchema>
export type UpdateTenantBody = z.infer<typeof updateTenantSchema>
