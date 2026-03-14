import { appUsers } from '@appfy/db'
import type { PaginationParams } from '@appfy/shared'
import { and, count, desc, eq } from 'drizzle-orm'
import { paginationOffset } from '../common/pagination.js'
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
  readonly pushOptIn?: boolean
  readonly lastActiveAt?: Date
  readonly totalPurchases?: number
  readonly totalSpent?: number
}

export class AppUserRepository extends BaseRepository {
  async findById(tenantId: string, id: string): Promise<AppUserRow | undefined> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select()
      .from(appUsers)
      .where(and(eq(appUsers.tenantId, tenantId), eq(appUsers.id, id)))
      .limit(1)
    return rows[0] as AppUserRow | undefined
  }

  async findByExternalId(tenantId: string, externalId: string): Promise<AppUserRow | undefined> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select()
      .from(appUsers)
      .where(and(eq(appUsers.tenantId, tenantId), eq(appUsers.userIdExternal, externalId)))
      .limit(1)
    return rows[0] as AppUserRow | undefined
  }

  async create(tenantId: string, input: CreateAppUserInput): Promise<AppUserRow> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .insert(appUsers)
      .values({
        tenantId,
        userIdExternal: input.userIdExternal,
        email: input.email,
        name: input.name,
      })
      .returning()
    return rows[0] as AppUserRow
  }

  async update(tenantId: string, id: string, input: UpdateAppUserInput): Promise<AppUserRow> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .update(appUsers)
      .set({
        ...(input.email !== undefined && { email: input.email }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.pushOptIn !== undefined && { pushOptIn: input.pushOptIn }),
        ...(input.lastActiveAt !== undefined && { lastActiveAt: input.lastActiveAt }),
        ...(input.totalPurchases !== undefined && { totalPurchases: input.totalPurchases }),
        ...(input.totalSpent !== undefined && { totalSpent: input.totalSpent }),
        updatedAt: new Date(),
      })
      .where(and(eq(appUsers.tenantId, tenantId), eq(appUsers.id, id)))
      .returning()
    return rows[0] as AppUserRow
  }

  async upsertByExternalId(
    tenantId: string,
    externalId: string,
    input: CreateAppUserInput,
  ): Promise<AppUserRow> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .insert(appUsers)
      .values({
        tenantId,
        userIdExternal: externalId,
        email: input.email,
        name: input.name,
      })
      .onConflictDoUpdate({
        target: [appUsers.tenantId, appUsers.userIdExternal],
        set: {
          ...(input.email !== undefined && { email: input.email }),
          ...(input.name !== undefined && { name: input.name }),
          updatedAt: new Date(),
        },
      })
      .returning()
    return rows[0] as AppUserRow
  }

  async updatePushOptIn(tenantId: string, id: string, optIn: boolean): Promise<void> {
    this.assertTenantId(tenantId)
    await this.db
      .update(appUsers)
      .set({ pushOptIn: optIn, updatedAt: new Date() })
      .where(and(eq(appUsers.tenantId, tenantId), eq(appUsers.id, id)))
  }

  async list(
    tenantId: string,
    pagination: PaginationParams,
  ): Promise<{ data: AppUserRow[]; total: number }> {
    this.assertTenantId(tenantId)
    const offset = paginationOffset(pagination)

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(appUsers)
        .where(eq(appUsers.tenantId, tenantId))
        .orderBy(desc(appUsers.createdAt))
        .limit(pagination.perPage)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(appUsers)
        .where(eq(appUsers.tenantId, tenantId)),
    ])

    return {
      data: data as AppUserRow[],
      total: Number(countResult[0]?.total ?? 0),
    }
  }

  async delete(tenantId: string, id: string): Promise<void> {
    this.assertTenantId(tenantId)
    await this.db
      .delete(appUsers)
      .where(and(eq(appUsers.tenantId, tenantId), eq(appUsers.id, id)))
  }

  async count(tenantId: string): Promise<number> {
    this.assertTenantId(tenantId)
    const result = await this.db
      .select({ total: count() })
      .from(appUsers)
      .where(eq(appUsers.tenantId, tenantId))
    return Number(result[0]?.total ?? 0)
  }
}
