import { z } from 'zod'

export const createNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  type: z.enum(['manual', 'automated']).default('manual'),
  segmentRules: z.record(z.unknown()).optional(),
})

export const listNotificationsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
  type: z.enum(['manual', 'automated']).optional(),
})

export type CreateNotificationBody = z.infer<typeof createNotificationSchema>
export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>
