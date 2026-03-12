import type { DeliveryStatus } from '@appfy/shared'

export interface DeliveryRow {
  readonly id: string
  readonly tenantId: string
  readonly notificationId: string
  readonly deviceId: string
  readonly status: DeliveryStatus
  readonly sentAt: Date | null
  readonly deliveredAt: Date | null
  readonly openedAt: Date | null
  readonly clickedAt: Date | null
  readonly convertedAt: Date | null
  readonly failedAt: Date | null
  readonly failureReason: string | null
  readonly createdAt: Date
}

export class DeliveryBuilder {
  private data: DeliveryRow = {
    id: crypto.randomUUID(),
    tenantId: '',
    notificationId: crypto.randomUUID(),
    deviceId: crypto.randomUUID(),
    status: 'pending',
    sentAt: null,
    deliveredAt: null,
    openedAt: null,
    clickedAt: null,
    convertedAt: null,
    failedAt: null,
    failureReason: null,
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

  withNotification(notificationId: string): this {
    this.data = { ...this.data, notificationId }
    return this
  }

  withDevice(deviceId: string): this {
    this.data = { ...this.data, deviceId }
    return this
  }

  pending(): this {
    this.data = { ...this.data, status: 'pending' }
    return this
  }

  sent(): this {
    this.data = { ...this.data, status: 'sent', sentAt: new Date() }
    return this
  }

  delivered(): this {
    this.data = { ...this.data, status: 'delivered', deliveredAt: new Date() }
    return this
  }

  opened(): this {
    this.data = { ...this.data, status: 'opened', openedAt: new Date() }
    return this
  }

  clicked(): this {
    this.data = { ...this.data, status: 'clicked', clickedAt: new Date() }
    return this
  }

  converted(): this {
    this.data = { ...this.data, status: 'converted', convertedAt: new Date() }
    return this
  }

  failed(reason?: string): this {
    this.data = {
      ...this.data,
      status: 'failed',
      failedAt: new Date(),
      failureReason: reason ?? null,
    }
    return this
  }

  build(): DeliveryRow {
    if (!this.data.tenantId) {
      throw new Error('DeliveryBuilder: tenantId is required. Use .withTenant()')
    }
    return { ...this.data }
  }
}
