import { z } from 'zod'

export const analyticsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('30d'),
})

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>
