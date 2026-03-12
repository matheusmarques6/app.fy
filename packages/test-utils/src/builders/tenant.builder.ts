import type { TenantRow } from '@appfy/core'

export class TenantBuilder {
  private data: TenantRow = {
    id: crypto.randomUUID(),
    name: 'Test Tenant',
    slug: `tenant-${crypto.randomUUID().slice(0, 8)}`,
    platform: 'shopify',
    isActive: true,
    notificationCountCurrentPeriod: 0,
    notificationLimit: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  withId(id: string): this {
    this.data = { ...this.data, id }
    return this
  }

  withName(name: string): this {
    this.data = { ...this.data, name }
    return this
  }

  withSlug(slug: string): this {
    this.data = { ...this.data, slug }
    return this
  }

  withPlatform(platform: string): this {
    this.data = { ...this.data, platform }
    return this
  }

  shopify(): this {
    return this.withPlatform('shopify')
  }

  nuvemshop(): this {
    return this.withPlatform('nuvemshop')
  }

  inactive(): this {
    this.data = { ...this.data, isActive: false }
    return this
  }

  withPlan(limit: number): this {
    this.data = { ...this.data, notificationLimit: limit }
    return this
  }

  withStripe(limit: number): this {
    return this.withPlan(limit)
  }

  withNotificationCount(count: number): this {
    this.data = { ...this.data, notificationCountCurrentPeriod: count }
    return this
  }

  withNotificationLimit(limit: number): this {
    this.data = { ...this.data, notificationLimit: limit }
    return this
  }

  build(): TenantRow {
    return { ...this.data }
  }
}
