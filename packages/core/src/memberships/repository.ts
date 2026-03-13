import type { MembershipRole } from '@appfy/shared'
import { BaseRepository } from '../repositories/base.repository.js'

export interface MembershipRow {
  readonly id: string
  readonly userId: string
  readonly tenantId: string
  readonly role: MembershipRole
  readonly createdAt: Date
  readonly updatedAt: Date
}

export class MembershipRepository extends BaseRepository {
  async findByUserAndTenant(tenantId: string, _userId: string): Promise<MembershipRow | undefined> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }
}
