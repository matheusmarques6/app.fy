import type { FlowType } from '@appfy/shared'

/** Notification template definition */
export interface NotificationTemplate {
  readonly flowType: FlowType
  readonly title: string
  readonly body: string
  readonly variables: readonly string[]
}
