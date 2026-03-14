/** App user — end user of the mobile app (customer of the tenant) */
export interface AppUser {
  readonly id: string
  readonly tenantId: string
  readonly externalId: string | null
  readonly email: string | null
  readonly name: string | null
  readonly pushOptIn: boolean
  readonly totalPurchases: number
  readonly totalSpent: number
  readonly createdAt: Date
  readonly updatedAt: Date
}
