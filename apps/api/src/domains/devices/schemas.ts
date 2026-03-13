import { z } from 'zod'

export const registerDeviceSchema = z.object({
  appUserId: z.string().uuid(),
  deviceToken: z.string().min(1),
  platform: z.enum(['android', 'ios']),
  deviceModel: z.string().optional(),
  osVersion: z.string().optional(),
})

export type RegisterDeviceBody = z.infer<typeof registerDeviceSchema>
