import { z } from 'zod'
import { appEventTypes } from '@appfy/shared'

export const ingestEventSchema = z.object({
  appUserId: z.string().uuid(),
  eventType: z.enum(appEventTypes),
  properties: z.record(z.unknown()).optional(),
})

export const listEventsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  eventType: z.enum(appEventTypes).optional(),
  appUserId: z.string().uuid().optional(),
})

export type IngestEventBody = z.infer<typeof ingestEventSchema>
export type ListEventsQuery = z.infer<typeof listEventsSchema>
