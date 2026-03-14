import { z } from 'zod'

export const analyticsPeriodSchema = z.enum(['7d', '30d', '90d']).default('30d')

export type AnalyticsPeriodParam = z.infer<typeof analyticsPeriodSchema>
