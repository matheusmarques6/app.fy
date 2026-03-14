import { beforeEach, describe, expect, it } from 'vitest'
import { DomainError } from '../errors.js'
import type { CreateSegmentInput, SegmentRow, UpdateSegmentInput } from './repository.js'
import type { SegmentRuleGroup } from './rules-engine.js'
import { SegmentNotFoundError, SegmentService } from './service.js'

function makeSeg(overrides: Partial<SegmentRow> = {}): SegmentRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tenantId: overrides.tenantId ?? 'tenant-1',
    name: overrides.name ?? 'Test Segment',
    description: null, rules: { operator: 'AND', conditions: [] },
    userCount: 0, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

class SegRepoSpy {
  result: SegmentRow | undefined = undefined
  listResult = { data: [] as SegmentRow[], total: 0 }
  memberIds: string[] = []
  calls: Record<string, number> = {}
  private track(m: string) { this.calls[m] = (this.calls[m] ?? 0) + 1 }

  async findById(_t: string, _id: string) { this.track('findById'); return this.result }
  async create(t: string, input: CreateSegmentInput): Promise<SegmentRow> {
    this.track('create')
    return this.result ?? makeSeg({ tenantId: t, name: input.name, rules: input.rules })
  }
  async update(t: string, id: string, input: UpdateSegmentInput): Promise<SegmentRow> {
    this.track('update')
    return this.result ?? makeSeg({ id, tenantId: t, name: input.name ?? 'Updated' })
  }
  async delete(_t: string, _id: string) { this.track('delete') }
  async list(_t: string, _p: unknown) { this.track('list'); return this.listResult }
  async getMembers(_t: string, _sid: string, _p: unknown) { this.track('getMembers'); return { data: this.memberIds, total: this.memberIds.length } }
}

describe('SegmentService (Layer 2)', () => {
  const tenantId = 'tenant-1'
  let repo: SegRepoSpy
  let sut: SegmentService
  const validRules: SegmentRuleGroup = { operator: 'AND', conditions: [{ field: 'totalSpent', op: 'gte', value: 100 }] }

  function makeSut() { repo = new SegRepoSpy(); sut = new SegmentService(repo as never) }
  beforeEach(() => makeSut())

  describe('create', () => {
    it('should create with valid input', async () => {
      const result = await sut.create(tenantId, { name: 'High Value', rules: validRules })
      expect(result.name).toBe('High Value')
      expect(repo.calls.create).toBe(1)
    })
    it('should throw for empty name', async () => {
      await expect(sut.create(tenantId, { name: '', rules: validRules })).rejects.toThrow(DomainError)
    })
    it('should throw for invalid rules', async () => {
      await expect(sut.create(tenantId, { name: 'Bad', rules: { operator: 'XAND' } as never })).rejects.toThrow(DomainError)
    })
    it('should accept empty conditions', async () => {
      const result = await sut.create(tenantId, { name: 'All', rules: { operator: 'AND', conditions: [] } })
      expect(result).toBeDefined()
    })
  })

  describe('findById', () => {
    it('should return when found', async () => {
      repo.result = makeSeg({ id: 'seg-1', tenantId })
      expect((await sut.findById(tenantId, 'seg-1')).id).toBe('seg-1')
    })
    it('should throw SegmentNotFoundError', async () => {
      repo.result = undefined
      await expect(sut.findById(tenantId, 'x')).rejects.toThrow(SegmentNotFoundError)
    })
  })

  describe('update', () => {
    it('should update existing', async () => {
      repo.result = makeSeg({ id: 'seg-1', tenantId })
      await sut.update(tenantId, 'seg-1', { name: 'New' })
      expect(repo.calls.update).toBe(1)
    })
    it('should validate rules on update', async () => {
      repo.result = makeSeg({ id: 'seg-1', tenantId })
      await expect(sut.update(tenantId, 'seg-1', { rules: { operator: 'AND', conditions: [{ field: '', op: 'eq', value: 1 }] } as never })).rejects.toThrow(DomainError)
    })
  })

  describe('delete', () => {
    it('should delete existing', async () => {
      repo.result = makeSeg({ id: 'seg-1', tenantId })
      await sut.delete(tenantId, 'seg-1')
      expect(repo.calls.delete).toBe(1)
    })
    it('should throw if not found', async () => {
      repo.result = undefined
      await expect(sut.delete(tenantId, 'x')).rejects.toThrow(SegmentNotFoundError)
    })
  })

  describe('list', () => {
    it('should return paginated', async () => {
      const result = await sut.list(tenantId)
      expect(result.meta.page).toBe(1)
      expect(repo.calls.list).toBe(1)
    })
  })

  describe('getMembers', () => {
    it('should return member IDs', async () => {
      repo.result = makeSeg({ id: 'seg-1', tenantId })
      repo.memberIds = ['u-1', 'u-2']
      const result = await sut.getMembers(tenantId, 'seg-1')
      expect(result.data).toEqual(['u-1', 'u-2'])
      expect(result.meta.total).toBe(2)
    })
  })
})
