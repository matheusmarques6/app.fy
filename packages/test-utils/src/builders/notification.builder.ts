import type { Notification } from '@appfy/core'
import type { FlowType, NotificationStatus, NotificationType } from '@appfy/shared'

export class NotificationBuilder {
  private data: Notification = {
    id: crypto.randomUUID(),
    tenantId: crypto.randomUUID(),
    title: 'Test Notification',
    body: 'Test notification body',
    type: 'manual',
    flowType: null,
    imageUrl: null,
    targetUrl: null,
    segmentRules: null,
    scheduledAt: null,
    sentAt: null,
    status: 'draft',
    createdBy: null,
    abVariant: null,
    abConfig: null,
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

  withTitle(title: string): this {
    this.data = { ...this.data, title }
    return this
  }

  withBody(body: string): this {
    this.data = { ...this.data, body }
    return this
  }

  withStatus(status: NotificationStatus): this {
    this.data = { ...this.data, status }
    return this
  }

  withType(type: NotificationType): this {
    this.data = { ...this.data, type }
    return this
  }

  manual(): this {
    this.data = { ...this.data, type: 'manual', flowType: null }
    return this
  }

  automated(flowType: FlowType): this {
    this.data = { ...this.data, type: 'automated', flowType }
    return this
  }

  scheduled(date: Date): this {
    this.data = { ...this.data, scheduledAt: date, status: 'scheduled' }
    return this
  }

  sent(): this {
    this.data = { ...this.data, status: 'sent', sentAt: new Date() }
    return this
  }

  failed(): this {
    return this.withStatus('failed')
  }

  withAbVariant(variant: 'a' | 'b'): this {
    this.data = { ...this.data, abVariant: variant }
    return this
  }

  withAbConfig(config: unknown): this {
    this.data = { ...this.data, abConfig: config }
    return this
  }

  withImage(url: string): this {
    this.data = { ...this.data, imageUrl: url }
    return this
  }

  withTarget(url: string): this {
    this.data = { ...this.data, targetUrl: url }
    return this
  }

  build(): Notification {
    return { ...this.data }
  }
}
