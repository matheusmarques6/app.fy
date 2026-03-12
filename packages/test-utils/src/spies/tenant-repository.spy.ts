import type { CreateTenantInput, TenantRow, UpdateTenantInput } from '@appfy/core'
import { TenantBuilder } from '../builders/tenant.builder.js'
import { SpyBase } from './spy-base.js'

/** Mirrors {@link TenantRepository} from @appfy/core (concrete class, not interface) */
export class TenantRepositorySpy extends SpyBase {
  result: TenantRow | undefined = undefined

  async findById(tenantId: string): Promise<TenantRow | undefined> {
    this.trackCall('findById', [tenantId])
    return this.result
  }

  async findBySlug(tenantId: string, slug: string): Promise<TenantRow | undefined> {
    this.trackCall('findBySlug', [tenantId, slug])
    return this.result
  }

  async create(tenantId: string, input: CreateTenantInput): Promise<TenantRow> {
    this.trackCall('create', [tenantId, input])
    return this.result ?? new TenantBuilder().withName(input.name).withSlug(input.slug).build()
  }

  async update(tenantId: string, input: UpdateTenantInput): Promise<TenantRow> {
    this.trackCall('update', [tenantId, input])
    if (!this.result) throw new Error('TenantRepositorySpy: set .result before calling update')
    return this.result
  }

  async incrementNotificationCount(tenantId: string, amount: number): Promise<void> {
    this.trackCall('incrementNotificationCount', [tenantId, amount])
  }
}
