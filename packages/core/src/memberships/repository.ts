import { memberships } from '@appfy/db'
import type { MembershipRole } from '@appfy/shared'
import { and, eq } from 'drizzle-orm'
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
  async findByUserAndTenant(tenantId: string, userId: string): Promise<MembershipRow | undefined> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select()
      .from(memberships)
      .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)))
      .limit(1)
    return rows[0] as MembershipRow | undefined
  }
}
