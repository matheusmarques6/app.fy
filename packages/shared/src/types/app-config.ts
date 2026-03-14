import type { BuildStatus } from '../constants/event-types.js'

/** App visual configuration per tenant */
export interface AppConfig {
  readonly id: string
  readonly tenantId: string
  readonly appName: string
  readonly primaryColor: string
  readonly secondaryColor: string
  readonly iconUrl: string | null
  readonly splashUrl: string | null
  readonly buildStatus: BuildStatus
  readonly createdAt: Date
  readonly updatedAt: Date
}
