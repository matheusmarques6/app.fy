import type { MembershipRole } from '@appfy/shared'

export interface MembershipRow {
  readonly id: string
  readonly userId: string
  readonly tenantId: string
  readonly role: MembershipRole
  readonly createdAt: Date
  readonly updatedAt: Date
}

export class MembershipBuilder {
  private data: MembershipRow = {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    tenantId: '',
    role: 'editor',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  withId(id: string): this {
    this.data = { ...this.data, id }
    return this
  }

  withUser(userId: string): this {
    this.data = { ...this.data, userId }
    return this
  }

  withTenant(tenantId: string): this {
    this.data = { ...this.data, tenantId }
    return this
  }

  owner(): this {
    this.data = { ...this.data, role: 'owner' }
    return this
  }

  editor(): this {
    this.data = { ...this.data, role: 'editor' }
    return this
  }

  viewer(): this {
    this.data = { ...this.data, role: 'viewer' }
    return this
  }

  build(): MembershipRow {
    if (!this.data.tenantId) {
      throw new Error('MembershipBuilder: tenantId is required. Use .withTenant()')
    }
    return { ...this.data }
  }
}
