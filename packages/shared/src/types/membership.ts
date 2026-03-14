import type { MembershipRole } from '../constants/roles.js'

/** Tenant membership linking user to tenant with a role */
export interface Membership {
  readonly id: string
  readonly tenantId: string
  readonly userId: string
  readonly role: MembershipRole
  readonly createdAt: Date
}
