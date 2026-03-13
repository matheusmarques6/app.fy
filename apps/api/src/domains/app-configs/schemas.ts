import { z } from 'zod'

export const updateAppConfigSchema = z.object({
  appName: z.string().min(1).max(100).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  iconUrl: z.string().url().optional(),
  splashUrl: z.string().url().optional(),
})

export type UpdateAppConfigBody = z.infer<typeof updateAppConfigSchema>
