import type { AppUserRow } from '@appfy/core'

export class AppUserBuilder {
  private data: AppUserRow = {
    id: crypto.randomUUID(),
    tenantId: crypto.randomUUID(),
    userIdExternal: null,
    email: null,
    name: null,
    pushOptIn: true,
    lastActiveAt: null,
    totalPurchases: 0,
    totalSpent: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  withId(id: string): this {
    this.data = { ...this.data, id }
    return this
  }

  withTenant(tenantId: string): this {
    this.data = { ...this.data, tenantId }
    return this
  }

  withEmail(email: string): this {
    this.data = { ...this.data, email }
    return this
  }

  withName(name: string): this {
    this.data = { ...this.data, name }
    return this
  }

  withExternalId(externalId: string): this {
    this.data = { ...this.data, userIdExternal: externalId }
    return this
  }

  optedIn(): this {
    this.data = { ...this.data, pushOptIn: true }
    return this
  }

  optedOut(): this {
    this.data = { ...this.data, pushOptIn: false }
    return this
  }

  highValue(): this {
    this.data = { ...this.data, totalPurchases: 10, totalSpent: 5000 }
    return this
  }

  withPurchases(count: number, totalSpent: number): this {
    this.data = { ...this.data, totalPurchases: count, totalSpent }
    return this
  }

  build(): AppUserRow {
    return { ...this.data }
  }
}
