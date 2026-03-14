import { z } from 'zod'

export const listAppUsersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type ListAppUsersQuery = z.infer<typeof listAppUsersSchema>

export const createAppUserSchema = z.object({
  externalId: z.string().optional(),
  email: z.string().email().max(320).optional(),
  name: z.string().max(255).optional(),
})

export type CreateAppUserBody = z.infer<typeof createAppUserSchema>

export const updateAppUserSchema = z.object({
  email: z.string().email().max(320).optional(),
  name: z.string().max(255).optional(),
  pushOptIn: z.boolean().optional(),
})

export type UpdateAppUserBody = z.infer<typeof updateAppUserSchema>
