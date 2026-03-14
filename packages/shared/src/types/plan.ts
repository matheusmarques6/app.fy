import type { PlanName } from '../constants/plans.js'

/** Plan entity stored in the database */
export interface Plan {
  readonly id: string
  readonly name: PlanName
  readonly priceInCents: number
  readonly currency: string
  readonly manualNotificationsPerMonth: number | null
  readonly dailyPushLimitPerUser: number | null
  readonly stripePriceId: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}
