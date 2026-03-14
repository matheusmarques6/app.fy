import { tenants } from '@appfy/db'
import { eq, sql } from 'drizzle-orm'
import { BaseRepository } from '../repositories/base.repository.js'

export interface TenantRow {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly platform: string | null
  readonly onesignalAppId: string | null
  readonly isActive: boolean
  readonly notificationCountCurrentPeriod: number
  readonly notificationLimit: number | null
  readonly stripeCustomerId: string | null
  readonly stripeSubscriptionId: string | null
  readonly planId: string | null
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
    const rows = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1)
    return rows[0] as TenantRow | undefined
  }

  async findBySlug(tenantId: string, slug: string): Promise<TenantRow | undefined> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1)
    const row = rows[0] as TenantRow | undefined
    if (row && row.id !== tenantId) return undefined
    return row
  }

  async create(tenantId: string, input: CreateTenantInput): Promise<TenantRow> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .insert(tenants)
      .values({
        id: tenantId,
        name: input.name,
        slug: input.slug,
        platform: input.platform as 'shopify' | 'nuvemshop' | undefined,
      })
      .returning()
    return rows[0] as TenantRow
  }

  async update(tenantId: string, input: UpdateTenantInput): Promise<TenantRow> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .update(tenants)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.platform !== undefined && { platform: input.platform as 'shopify' | 'nuvemshop' }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning()
    return rows[0] as TenantRow
  }

  async incrementNotificationCount(tenantId: string, amount: number): Promise<void> {
    this.assertTenantId(tenantId)
    await this.db
      .update(tenants)
      .set({
        notificationCountCurrentPeriod: sql`${tenants.notificationCountCurrentPeriod} + ${amount}`,
      })
      .where(eq(tenants.id, tenantId))
  }

  async updateStripeIds(
    tenantId: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
  ): Promise<void> {
    this.assertTenantId(tenantId)
    await this.db
      .update(tenants)
      .set({
        stripeCustomerId,
        stripeSubscriptionId,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
  }

  async resetNotificationCount(tenantId: string): Promise<void> {
    this.assertTenantId(tenantId)
    await this.db
      .update(tenants)
      .set({
        notificationCountCurrentPeriod: 0,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
  }

  async deactivate(tenantId: string): Promise<void> {
    this.assertTenantId(tenantId)
    await this.db
      .update(tenants)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
  }
}
