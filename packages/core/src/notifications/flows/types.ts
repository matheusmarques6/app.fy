import type { AppEventType, FlowType } from '@appfy/shared'

/** Flow definition — maps a trigger event to a notification flow */
export interface FlowDefinition {
  readonly flowType: FlowType
  readonly triggerEvent: AppEventType | string
  readonly defaultDelaySeconds: number
  readonly templateRef: string
  readonly description: string
}
