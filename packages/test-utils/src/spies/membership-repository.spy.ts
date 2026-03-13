import type { MembershipRole } from '@appfy/shared'
import type { MembershipRow } from '@appfy/core'
import { MembershipBuilder } from '../builders/membership.builder.js'
import { SpyBase } from './spy-base.js'

export class MembershipRepositorySpy extends SpyBase {
  result: MembershipRow | undefined = undefined
  listResult: MembershipRow[] = []

  async findByUserAndTenant(tenantId: string, userId: string): Promise<MembershipRow | undefined> {
    this.trackCall('findByUserAndTenant', [tenantId, userId])
    return this.result
  }

  async listByUser(userId: string): Promise<MembershipRow[]> {
    this.trackCall('listByUser', [userId])
    return this.listResult
  }

  async listByTenant(tenantId: string): Promise<MembershipRow[]> {
    this.trackCall('listByTenant', [tenantId])
    return this.listResult
  }

  async create(userId: string, tenantId: string, role: MembershipRole): Promise<MembershipRow> {
    this.trackCall('create', [userId, tenantId, role])
    return this.result ?? new MembershipBuilder().withUser(userId).withTenant(tenantId).build()
  }

  async delete(userId: string, tenantId: string): Promise<void> {
    this.trackCall('delete', [userId, tenantId])
  }
}
