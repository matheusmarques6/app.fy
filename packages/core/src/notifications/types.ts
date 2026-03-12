import type { FlowType, NotificationStatus, NotificationType } from '@appfy/shared'

/** Notification domain entity */
export interface Notification {
  readonly id: string
  readonly tenantId: string
  readonly type: NotificationType
  readonly flowType: FlowType | null
  readonly title: string
  readonly body: string
  readonly imageUrl: string | null
  readonly targetUrl: string | null
  readonly segmentRules: unknown
  readonly scheduledAt: Date | null
  readonly sentAt: Date | null
  readonly status: NotificationStatus
  readonly createdBy: string | null
  readonly abVariant: 'a' | 'b' | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

/** Input for creating a notification (draft) */
export interface CreateNotificationInput {
  readonly type: NotificationType
  readonly flowType?: FlowType
  readonly title: string
  readonly body: string
  readonly imageUrl?: string
  readonly targetUrl?: string
  readonly segmentRules?: unknown
  readonly scheduledAt?: Date
  readonly createdBy?: string
  readonly abVariant?: 'a' | 'b'
}

/** Input for updating notification status */
export interface UpdateNotificationStatusInput {
  readonly status: NotificationStatus
  readonly sentAt?: Date
}

/** Pipeline context passed through each pipeline step */
export interface PipelineContext {
  readonly tenantId: string
  readonly notification: Notification
  readonly recipientTokens: string[]
  readonly appId: string
}

/** Result of the full notification pipeline */
export interface PipelineResult {
  readonly notificationId: string
  readonly recipientCount: number
  readonly scheduledAt: Date | null
  readonly status: 'sent' | 'scheduled' | 'failed'
  readonly error?: string
}
