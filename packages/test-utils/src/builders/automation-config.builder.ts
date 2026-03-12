import type { AutomationConfigRow } from '@appfy/core'
import type { FlowType } from '@appfy/shared'

export class AutomationConfigBuilder {
  private data: AutomationConfigRow = {
    id: crypto.randomUUID(),
    tenantId: '',
    flowType: 'cart_abandoned',
    isEnabled: true,
    delaySeconds: 3600,
    templateTitle: 'You left something behind!',
    templateBody: 'Complete your purchase, {{user_name}}!',
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

  withFlowType(flowType: FlowType): this {
    this.data = { ...this.data, flowType }
    return this
  }

  enabled(): this {
    this.data = { ...this.data, isEnabled: true }
    return this
  }

  disabled(): this {
    this.data = { ...this.data, isEnabled: false }
    return this
  }

  withDelay(seconds: number): this {
    this.data = { ...this.data, delaySeconds: seconds }
    return this
  }

  withTemplate(title: string, body: string): this {
    this.data = { ...this.data, templateTitle: title, templateBody: body }
    return this
  }

  build(): AutomationConfigRow {
    if (!this.data.tenantId) {
      throw new Error('AutomationConfigBuilder: tenantId is required. Use .withTenant()')
    }
    return { ...this.data }
  }
}
