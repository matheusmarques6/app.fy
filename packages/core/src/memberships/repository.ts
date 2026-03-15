import { memberships, tenants } from '@appfy/db'
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

export interface MembershipWithTenant {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly platform: string | null
  readonly role: MembershipRole
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

  // Cross-tenant by design: lists all tenants for a user (no tenant context yet).
  // Intentionally skips assertTenantId() — user authentication is the access control.
  async findByUserId(userId: string): Promise<MembershipWithTenant[]> {
    const rows = await this.db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        platform: tenants.platform,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(tenants, eq(memberships.tenantId, tenants.id))
      .where(eq(memberships.userId, userId))
      .orderBy(tenants.name)
    return rows as MembershipWithTenant[]
  }
}
