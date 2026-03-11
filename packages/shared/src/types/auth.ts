import type { MembershipRole } from '../constants/roles.js'

/** JWT payload after Supabase Auth + tenant switch */
export interface JwtPayload {
  readonly sub: string
  readonly email: string
  readonly tenantId: string | null
  readonly role: MembershipRole | null
  readonly iat: number
  readonly exp: number
}

/** Authenticated session context used across API/workers */
export interface AuthSession {
  readonly userId: string
  readonly email: string
  readonly tenantId: string
  readonly role: MembershipRole
}

/** Device JWT payload (mobile SDK auth) */
export interface DeviceJwtPayload {
  readonly sub: string
  readonly deviceId: string
  readonly tenantId: string
  readonly platform: 'android' | 'ios'
  readonly iat: number
  readonly exp: number
}
