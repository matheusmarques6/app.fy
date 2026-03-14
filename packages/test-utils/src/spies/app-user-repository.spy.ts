import type { AppUserRow, CreateAppUserInput, UpdateAppUserInput } from '@appfy/core'
import type { PaginationParams } from '@appfy/shared'
import { AppUserBuilder } from '../builders/app-user.builder.js'
import { SpyBase } from './spy-base.js'

/** Mirrors {@link AppUserRepository} from @appfy/core */
export class AppUserRepositorySpy extends SpyBase {
  result: AppUserRow | undefined = undefined
  listResult: { data: AppUserRow[]; total: number } = { data: [], total: 0 }

  async findById(tenantId: string, id: string): Promise<AppUserRow | undefined> {
    this.trackCall('findById', [tenantId, id])
    return this.result
  }

  async findByExternalId(tenantId: string, externalId: string): Promise<AppUserRow | undefined> {
    this.trackCall('findByExternalId', [tenantId, externalId])
    return this.result
  }

  async create(tenantId: string, input: CreateAppUserInput): Promise<AppUserRow> {
    this.trackCall('create', [tenantId, input])
    return (
      this.result ??
      new AppUserBuilder()
        .withTenant(tenantId)
        .withEmail(input.email ?? '')
        .withName(input.name ?? '')
        .build()
    )
  }

  async upsertByExternalId(
    tenantId: string,
    externalId: string,
    input: CreateAppUserInput,
  ): Promise<AppUserRow> {
    this.trackCall('upsertByExternalId', [tenantId, externalId, input])
    return (
      this.result ??
      new AppUserBuilder()
        .withTenant(tenantId)
        .withExternalId(externalId)
        .withEmail(input.email ?? '')
        .withName(input.name ?? '')
        .build()
    )
  }

  async update(tenantId: string, id: string, input: UpdateAppUserInput): Promise<AppUserRow> {
    this.trackCall('update', [tenantId, id, input])
    return this.result ?? new AppUserBuilder().withTenant(tenantId).withId(id).build()
  }

  async updatePushOptIn(tenantId: string, id: string, optIn: boolean): Promise<void> {
    this.trackCall('updatePushOptIn', [tenantId, id, optIn])
  }

  async list(
    tenantId: string,
    pagination: PaginationParams,
  ): Promise<{ data: AppUserRow[]; total: number }> {
    this.trackCall('list', [tenantId, pagination])
    return this.listResult
  }

  async delete(tenantId: string, id: string): Promise<void> {
    this.trackCall('delete', [tenantId, id])
  }

  async count(tenantId: string): Promise<number> {
    this.trackCall('count', [tenantId])
    return this.listResult.total
  }
}
