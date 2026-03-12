import type { PaginationParams } from '@appfy/shared'
import { BaseRepository } from '../repositories/base.repository.js'

export interface AppUserRow {
  readonly id: string
  readonly tenantId: string
  readonly userIdExternal: string | null
  readonly email: string | null
  readonly name: string | null
  readonly pushOptIn: boolean
  readonly lastActiveAt: Date | null
  readonly totalPurchases: number
  readonly totalSpent: number
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface CreateAppUserInput {
  readonly userIdExternal?: string
  readonly email?: string
  readonly name?: string
}

export interface UpdateAppUserInput {
  readonly email?: string
  readonly name?: string
  readonly lastActiveAt?: Date
  readonly totalPurchases?: number
  readonly totalSpent?: number
}

export class AppUserRepository extends BaseRepository {
  async findById(tenantId: string, _id: string): Promise<AppUserRow | undefined> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async findByExternalId(tenantId: string, _externalId: string): Promise<AppUserRow | undefined> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async create(tenantId: string, _input: CreateAppUserInput): Promise<AppUserRow> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async update(tenantId: string, _id: string, _input: UpdateAppUserInput): Promise<AppUserRow> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async updatePushOptIn(tenantId: string, _id: string, _optIn: boolean): Promise<void> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async list(
    tenantId: string,
    _pagination: PaginationParams,
  ): Promise<{ data: AppUserRow[]; total: number }> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }
}
