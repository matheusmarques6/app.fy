import { z } from 'zod'

export const switchTenantSchema = z.object({
  tenantId: z.string().uuid(),
})

export type SwitchTenantBody = z.infer<typeof switchTenantSchema>
