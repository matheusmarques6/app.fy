import { z } from 'zod'

export const platformParam = z.enum(['shopify', 'nuvemshop', 'klaviyo'])

export const connectSchema = z.object({
  redirectUrl: z.string().url(),
})

export type PlatformParam = z.infer<typeof platformParam>
export type ConnectBody = z.infer<typeof connectSchema>
