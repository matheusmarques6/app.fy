import type { AppEventType } from '../constants/event-types.js'

/** App event tracked by the mobile SDK */
export interface AppEvent {
  readonly id: string
  readonly tenantId: string
  readonly appUserId: string
  readonly eventType: AppEventType
  readonly properties: Record<string, unknown> | null
  readonly createdAt: Date
}
