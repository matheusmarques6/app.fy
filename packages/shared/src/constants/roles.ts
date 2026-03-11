export const membershipRoles = ['owner', 'editor', 'viewer'] as const
export type MembershipRole = (typeof membershipRoles)[number]

/**
 * Permission flags per role.
 * - viewer: read only
 * - editor: read + write (no delete/billing/members)
 * - owner: total access
 */
export const rolePermissions = {
  viewer: {
    read: true,
    write: false,
    delete: false,
    billing: false,
    members: false,
  },
  editor: {
    read: true,
    write: true,
    delete: false,
    billing: false,
    members: false,
  },
  owner: {
    read: true,
    write: true,
    delete: true,
    billing: true,
    members: true,
  },
} as const satisfies Record<MembershipRole, RolePermission>

export interface RolePermission {
  readonly read: boolean
  readonly write: boolean
  readonly delete: boolean
  readonly billing: boolean
  readonly members: boolean
}
