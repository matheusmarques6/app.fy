import type { DeliveryStatus } from '../constants/event-types.js'

/** Individual push delivery to a device */
export interface Delivery {
  readonly id: string
  readonly tenantId: string
  readonly notificationId: string
  readonly deviceId: string
  readonly appUserId: string | null
  readonly status: DeliveryStatus
  readonly errorMessage: string | null
  readonly sentAt: Date | null
  readonly deliveredAt: Date | null
  readonly openedAt: Date | null
  readonly clickedAt: Date | null
  readonly convertedAt: Date | null
  readonly createdAt: Date
  readonly updatedAt: Date
}
