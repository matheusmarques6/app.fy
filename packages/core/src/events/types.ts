import type { AppEventType } from '@appfy/shared'

/** Row returned from the app_events table */
export interface AppEventRow {
  readonly id: string
  readonly tenantId: string
  readonly appUserId: string
  readonly eventType: AppEventType
  readonly properties: Record<string, unknown> | null
  readonly createdAt: Date
}

/** Input for creating an app event */
export interface CreateEventInput {
  readonly appUserId: string
  readonly eventType: AppEventType
  readonly properties?: Record<string, unknown>
}

/** Input for ingesting an event (before validation) */
export interface IngestEventInput {
  readonly appUserId: string
  readonly eventType: string
  readonly properties?: Record<string, unknown>
}

/** Filters for listing events */
export interface EventFilters {
  readonly eventType?: AppEventType
  readonly appUserId?: string
}
