import type { SegmentRow } from '@appfy/core'

export class SegmentBuilder {
  private data: SegmentRow = {
    id: crypto.randomUUID(),
    tenantId: crypto.randomUUID(),
    name: 'Test Segment',
    description: null,
    rules: { operator: 'AND', conditions: [] },
    userCount: 0,
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

  withName(name: string): this {
    this.data = { ...this.data, name }
    return this
  }

  withDescription(description: string): this {
    this.data = { ...this.data, description }
    return this
  }

  withRules(rules: SegmentRow['rules']): this {
    this.data = { ...this.data, rules }
    return this
  }

  highSpenders(): this {
    this.data = {
      ...this.data,
      name: 'High Spenders',
      rules: {
        operator: 'AND',
        conditions: [{ field: 'total_spent', op: 'gte', value: 1000 }],
      },
    }
    return this
  }

  optedIn(): this {
    this.data = {
      ...this.data,
      name: 'Push Opted In',
      rules: {
        operator: 'AND',
        conditions: [{ field: 'push_opt_in', op: 'eq', value: true }],
      },
    }
    return this
  }

  withUserCount(count: number): this {
    this.data = { ...this.data, userCount: count }
    return this
  }

  build(): SegmentRow {
    return { ...this.data }
  }
}
