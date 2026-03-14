import { appUserSegments, segments } from '@appfy/db'
import type { PaginationParams } from '@appfy/shared'
import { and, count, desc, eq, inArray, lt } from 'drizzle-orm'
import { paginationOffset } from '../common/pagination.js'
import { BaseRepository } from '../repositories/base.repository.js'
import type { SegmentRuleGroup } from './rules-engine.js'

export interface SegmentRow {
  readonly id: string
  readonly tenantId: string
  readonly name: string
  readonly description: string | null
  readonly rules: SegmentRuleGroup
  readonly userCount: number
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface CreateSegmentInput {
  readonly name: string
  readonly description?: string
  readonly rules: SegmentRuleGroup
}

export interface UpdateSegmentInput {
  readonly name?: string
  readonly description?: string
  readonly rules?: SegmentRuleGroup
}

export interface SegmentMembershipRow {
  readonly id: string
  readonly tenantId: string
  readonly segmentId: string
  readonly appUserId: string
  readonly assignedAt: Date
  readonly expiresAt: Date | null
}

export class SegmentRepository extends BaseRepository {
  async findById(tenantId: string, id: string): Promise<SegmentRow | undefined> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select()
      .from(segments)
      .where(and(eq(segments.tenantId, tenantId), eq(segments.id, id)))
      .limit(1)
    return rows[0] as SegmentRow | undefined
  }

  async create(tenantId: string, input: CreateSegmentInput): Promise<SegmentRow> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .insert(segments)
      .values({
        tenantId,
        name: input.name,
        description: input.description,
        rules: input.rules,
      })
      .returning()
    return rows[0] as SegmentRow
  }

  async update(tenantId: string, id: string, input: UpdateSegmentInput): Promise<SegmentRow> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .update(segments)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.rules !== undefined && { rules: input.rules }),
        updatedAt: new Date(),
      })
      .where(and(eq(segments.tenantId, tenantId), eq(segments.id, id)))
      .returning()
    return rows[0] as SegmentRow
  }

  async delete(tenantId: string, id: string): Promise<void> {
    this.assertTenantId(tenantId)
    await this.db.transaction(async (tx) => {
      await tx
        .delete(appUserSegments)
        .where(and(eq(appUserSegments.tenantId, tenantId), eq(appUserSegments.segmentId, id)))
      await tx
        .delete(segments)
        .where(and(eq(segments.tenantId, tenantId), eq(segments.id, id)))
    })
  }

  async list(
    tenantId: string,
    pagination: PaginationParams,
  ): Promise<{ data: SegmentRow[]; total: number }> {
    this.assertTenantId(tenantId)
    const offset = paginationOffset(pagination)

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(segments)
        .where(eq(segments.tenantId, tenantId))
        .orderBy(desc(segments.createdAt))
        .limit(pagination.perPage)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(segments)
        .where(eq(segments.tenantId, tenantId)),
    ])

    return {
      data: data as SegmentRow[],
      total: Number(countResult[0]?.total ?? 0),
    }
  }

  async addMembers(
    tenantId: string,
    segmentId: string,
    appUserIds: string[],
    expiresAt?: Date,
  ): Promise<void> {
    this.assertTenantId(tenantId)
    if (appUserIds.length === 0) return

    const values = appUserIds.map((appUserId) => ({
      tenantId,
      segmentId,
      appUserId,
      expiresAt: expiresAt ?? null,
    }))

    await this.db.insert(appUserSegments).values(values).onConflictDoNothing()
  }

  async removeMembers(
    tenantId: string,
    segmentId: string,
    appUserIds: string[],
  ): Promise<void> {
    this.assertTenantId(tenantId)
    if (appUserIds.length === 0) return

    await this.db
      .delete(appUserSegments)
      .where(
        and(
          eq(appUserSegments.tenantId, tenantId),
          eq(appUserSegments.segmentId, segmentId),
          inArray(appUserSegments.appUserId, appUserIds),
        ),
      )
  }

  async getMembers(
    tenantId: string,
    segmentId: string,
    pagination: PaginationParams,
  ): Promise<{ data: string[]; total: number }> {
    this.assertTenantId(tenantId)
    const offset = paginationOffset(pagination)

    const [data, countResult] = await Promise.all([
      this.db
        .select({ appUserId: appUserSegments.appUserId })
        .from(appUserSegments)
        .where(
          and(
            eq(appUserSegments.tenantId, tenantId),
            eq(appUserSegments.segmentId, segmentId),
          ),
        )
        .orderBy(desc(appUserSegments.assignedAt))
        .limit(pagination.perPage)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(appUserSegments)
        .where(
          and(
            eq(appUserSegments.tenantId, tenantId),
            eq(appUserSegments.segmentId, segmentId),
          ),
        ),
    ])

    return {
      data: data.map((r) => r.appUserId),
      total: Number(countResult[0]?.total ?? 0),
    }
  }

  async getMemberIds(tenantId: string, segmentId: string): Promise<string[]> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select({ appUserId: appUserSegments.appUserId })
      .from(appUserSegments)
      .where(
        and(
          eq(appUserSegments.tenantId, tenantId),
          eq(appUserSegments.segmentId, segmentId),
        ),
      )
    return rows.map((r) => r.appUserId)
  }

  async removeExpiredMembers(tenantId: string, segmentId: string): Promise<number> {
    this.assertTenantId(tenantId)
    const deleted = await this.db
      .delete(appUserSegments)
      .where(
        and(
          eq(appUserSegments.tenantId, tenantId),
          eq(appUserSegments.segmentId, segmentId),
          lt(appUserSegments.expiresAt, new Date()),
        ),
      )
      .returning()
    return deleted.length
  }

  /**
   * Remove an app user from ALL segments (LGPD data deletion).
   * @returns number of segment memberships removed
   */
  async removeMemberFromAll(tenantId: string, appUserId: string): Promise<number> {
    this.assertTenantId(tenantId)
    const deleted = await this.db
      .delete(appUserSegments)
      .where(
        and(
          eq(appUserSegments.tenantId, tenantId),
          eq(appUserSegments.appUserId, appUserId),
        ),
      )
      .returning()
    return deleted.length
  }

  async replaceMembers(
    tenantId: string,
    segmentId: string,
    appUserIds: string[],
    expiresAt?: Date,
  ): Promise<void> {
    this.assertTenantId(tenantId)
    await this.db.transaction(async (tx) => {
      await tx
        .delete(appUserSegments)
        .where(
          and(
            eq(appUserSegments.tenantId, tenantId),
            eq(appUserSegments.segmentId, segmentId),
          ),
        )

      if (appUserIds.length > 0) {
        const values = appUserIds.map((appUserId) => ({
          tenantId,
          segmentId,
          appUserId,
          expiresAt: expiresAt ?? null,
        }))
        await tx.insert(appUserSegments).values(values)
      }
    })
  }
}
