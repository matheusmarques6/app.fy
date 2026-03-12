import { BaseRepository } from '../repositories/base.repository.js'

export interface TenantRow {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly platform: string | null
  readonly isActive: boolean
  readonly notificationCountCurrentPeriod: number
  readonly notificationLimit: number | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface CreateTenantInput {
  readonly name: string
  readonly slug: string
  readonly platform?: string
}

export interface UpdateTenantInput {
  readonly name?: string
  readonly platform?: string
  readonly isActive?: boolean
}

export class TenantRepository extends BaseRepository {
  async findById(tenantId: string): Promise<TenantRow | undefined> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async findBySlug(tenantId: string, _slug: string): Promise<TenantRow | undefined> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async create(tenantId: string, _input: CreateTenantInput): Promise<TenantRow> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async update(tenantId: string, _input: UpdateTenantInput): Promise<TenantRow> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async incrementNotificationCount(tenantId: string, _amount: number): Promise<void> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }
}
