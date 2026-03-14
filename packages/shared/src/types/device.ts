import type { DevicePlatform } from '../constants/event-types.js'

/** Device registered by an app user */
export interface Device {
  readonly id: string
  readonly tenantId: string
  readonly appUserId: string
  readonly deviceToken: string
  readonly platform: DevicePlatform
  readonly isActive: boolean
  readonly createdAt: Date
  readonly updatedAt: Date
}
