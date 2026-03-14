import type { AppEventType } from '@appfy/shared'

export interface AppEventRow {
  readonly id: string
  readonly tenantId: string
  readonly appUserId: string | null
  readonly deviceId: string | null
  readonly eventType: AppEventType
  readonly properties: Record<string, unknown> | null
  readonly createdAt: Date
}

export class AppEventBuilder {
  private data: AppEventRow = {
    id: crypto.randomUUID(),
    tenantId: crypto.randomUUID(),
    appUserId: null,
    deviceId: null,
    eventType: 'app_opened',
    properties: null,
    createdAt: new Date(),
  }

  withId(id: string): this {
    this.data = { ...this.data, id }
    return this
  }

  withTenant(tenantId: string): this {
    this.data = { ...this.data, tenantId }
    return this
  }

  withUser(appUserId: string): this {
    this.data = { ...this.data, appUserId }
    return this
  }

  withDevice(deviceId: string): this {
    this.data = { ...this.data, deviceId }
    return this
  }

  appOpened(): this {
    this.data = { ...this.data, eventType: 'app_opened' }
    return this
  }

  productViewed(): this {
    this.data = { ...this.data, eventType: 'product_viewed' }
    return this
  }

  addToCart(): this {
    this.data = { ...this.data, eventType: 'add_to_cart' }
    return this
  }

  purchaseCompleted(): this {
    this.data = { ...this.data, eventType: 'purchase_completed' }
    return this
  }

  pushOpened(): this {
    this.data = { ...this.data, eventType: 'push_opened' }
    return this
  }

  pushClicked(): this {
    this.data = { ...this.data, eventType: 'push_clicked' }
    return this
  }

  withProperties(properties: Record<string, unknown>): this {
    this.data = { ...this.data, properties }
    return this
  }

  build(): AppEventRow {
    return { ...this.data }
  }
}
