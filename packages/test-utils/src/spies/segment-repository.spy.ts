import type {
  CreateSegmentInput,
  SegmentRow,
  UpdateSegmentInput,
} from '@appfy/core'
import type { PaginationParams } from '@appfy/shared'
import { SpyBase } from './spy-base.js'

/** Mirrors SegmentRepository from @appfy/core */
export class SegmentRepositorySpy extends SpyBase {
  result: SegmentRow | undefined = undefined
  listResult: { data: SegmentRow[]; total: number } = { data: [], total: 0 }
  memberIds: string[] = []

  async findById(tenantId: string, id: string): Promise<SegmentRow | undefined> {
    this.trackCall('findById', [tenantId, id])
    return this.result
  }

  async create(tenantId: string, input: CreateSegmentInput): Promise<SegmentRow> {
    this.trackCall('create', [tenantId, input])
    return (
      this.result ?? {
        id: crypto.randomUUID(),
        tenantId,
        name: input.name,
        description: input.description ?? null,
        rules: input.rules,
        userCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    )
  }

  async update(tenantId: string, id: string, input: UpdateSegmentInput): Promise<SegmentRow> {
    this.trackCall('update', [tenantId, id, input])
    return (
      this.result ?? {
        id,
        tenantId,
        name: input.name ?? 'Test Segment',
        description: input.description ?? null,
        rules: input.rules ?? { operator: 'AND' as const, conditions: [] },
        userCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    )
  }

  async delete(tenantId: string, id: string): Promise<void> {
    this.trackCall('delete', [tenantId, id])
  }

  async list(
    tenantId: string,
    pagination: PaginationParams,
  ): Promise<{ data: SegmentRow[]; total: number }> {
    this.trackCall('list', [tenantId, pagination])
    return this.listResult
  }

  async addMembers(
    tenantId: string,
    segmentId: string,
    appUserIds: string[],
    expiresAt?: Date,
  ): Promise<void> {
    this.trackCall('addMembers', [tenantId, segmentId, appUserIds, expiresAt])
  }

  async removeMembers(tenantId: string, segmentId: string, appUserIds: string[]): Promise<void> {
    this.trackCall('removeMembers', [tenantId, segmentId, appUserIds])
  }

  async getMembers(
    tenantId: string,
    segmentId: string,
    pagination: PaginationParams,
  ): Promise<{ data: string[]; total: number }> {
    this.trackCall('getMembers', [tenantId, segmentId, pagination])
    return { data: this.memberIds, total: this.memberIds.length }
  }

  async getMemberIds(tenantId: string, segmentId: string): Promise<string[]> {
    this.trackCall('getMemberIds', [tenantId, segmentId])
    return this.memberIds
  }

  async removeExpiredMembers(tenantId: string, segmentId: string): Promise<number> {
    this.trackCall('removeExpiredMembers', [tenantId, segmentId])
    return 0
  }

  async replaceMembers(
    tenantId: string,
    segmentId: string,
    appUserIds: string[],
    expiresAt?: Date,
  ): Promise<void> {
    this.trackCall('replaceMembers', [tenantId, segmentId, appUserIds, expiresAt])
  }
}
