import type { FlowType } from '../constants/flow-types.js'

/** Automation configuration per flow type per tenant */
export interface AutomationConfig {
  readonly id: string
  readonly tenantId: string
  readonly flowType: FlowType
  readonly isEnabled: boolean
  readonly delaySeconds: number
  readonly templateTitle: string
  readonly templateBody: string
  readonly createdAt: Date
  readonly updatedAt: Date
}
