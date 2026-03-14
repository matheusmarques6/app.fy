/** User from Supabase Auth */
export interface User {
  readonly id: string
  readonly email: string
  readonly name: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

/** User with membership context for a specific tenant */
export interface UserWithMembership extends User {
  readonly tenantId: string
  readonly role: import('../constants/roles.js').MembershipRole
}
