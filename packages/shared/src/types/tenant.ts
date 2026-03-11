import type { Platform } from '../constants/event-types.js'
import type { PlanName } from '../constants/plans.js'
import type { MembershipRole } from '../constants/roles.js'

export interface Tenant {
  readonly id: string
  readonly name: string
  readonly platform: Platform
  readonly planName: PlanName
  readonly onesignalAppId: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface TenantMembership {
  readonly id: string
  readonly tenantId: string
  readonly userId: string
  readonly role: MembershipRole
  readonly createdAt: Date
}

export interface TenantSwitchRequest {
  readonly tenantId: string
}

export interface TenantSwitchResponse {
  readonly accessToken: string
  readonly tenantId: string
  readonly role: MembershipRole
}
