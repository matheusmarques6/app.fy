import { z } from 'zod'

export const checkoutSchema = z.object({
  planName: z.enum(['starter', 'business', 'elite']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
})

export const portalSchema = z.object({
  returnUrl: z.string().url(),
})

export type CheckoutBody = z.infer<typeof checkoutSchema>
export type PortalBody = z.infer<typeof portalSchema>
