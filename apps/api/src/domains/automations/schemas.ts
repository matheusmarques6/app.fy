import { z } from 'zod'

export const updateAutomationSchema = z.object({
  delaySeconds: z.number().int().positive().optional(),
  templateTitle: z.string().min(1).max(200).optional(),
  templateBody: z.string().min(1).max(1000).optional(),
})

export const toggleAutomationSchema = z.object({
  isEnabled: z.boolean(),
})

export type UpdateAutomationBody = z.infer<typeof updateAutomationSchema>
export type ToggleAutomationBody = z.infer<typeof toggleAutomationSchema>
