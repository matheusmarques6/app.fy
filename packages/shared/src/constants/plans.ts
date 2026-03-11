export const planNames = ['starter', 'business', 'elite'] as const
export type PlanName = (typeof planNames)[number]

export interface PlanConfig {
  readonly name: PlanName
  readonly priceInCents: number
  readonly currency: 'BRL'
  readonly manualNotificationsPerMonth: number | null
  readonly unlimitedAutomated: true
}

export const plans = {
  starter: {
    name: 'starter',
    priceInCents: 12700,
    currency: 'BRL',
    manualNotificationsPerMonth: 15,
    unlimitedAutomated: true,
  },
  business: {
    name: 'business',
    priceInCents: 19700,
    currency: 'BRL',
    manualNotificationsPerMonth: null,
    unlimitedAutomated: true,
  },
  elite: {
    name: 'elite',
    priceInCents: 29700,
    currency: 'BRL',
    manualNotificationsPerMonth: null,
    unlimitedAutomated: true,
  },
} as const satisfies Record<PlanName, PlanConfig>
