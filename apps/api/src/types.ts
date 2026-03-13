import type { Dependencies } from '@appfy/core'
import type { MembershipRole } from '@appfy/shared'
import type { Hono } from 'hono'

/** Hono context variables available after middleware chain */
export interface AppVariables {
  userId: string
  tenantId: string
  userRole: MembershipRole
}

/** Hono app type with typed variables */
export type AppType = Hono<{ Variables: AppVariables }>

/** Dependencies injected into handlers */
export interface AppContext {
  deps: Dependencies
}
