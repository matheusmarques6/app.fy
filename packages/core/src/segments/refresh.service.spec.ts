import { beforeEach, describe, expect, it } from 'vitest'
import type { AppUserRow } from '../app-users/repository.js'
import type { SegmentRow } from './repository.js'
import type { SegmentRuleGroup } from './rules-engine.js'
import { SegmentRefreshService } from './refresh.service.js'

function makeUser(overrides: Partial<AppUserRow> = {}): AppUserRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tenantId: overrides.tenantId ?? 'tenant-1',
    userIdExternal: null, email: null, name: null,
    pushOptIn: overrides.pushOptIn ?? true, lastActiveAt: null,
    totalPurchases: overrides.totalPurchases ?? 0,
    totalSpent: overrides.totalSpent ?? 0,
    createdAt: new Date(), updatedAt: new Date(),
  }
}

class SegRepoSpy {
  result: SegmentRow | undefined = undefined
  memberIds: string[] = []
  calls: Record<string, number> = {}
  lastArgs: Record<string, unknown[]> = {}
  private track(m: string, args: unknown[]) { this.calls[m] = (this.calls[m] ?? 0) + 1; this.lastArgs[m] = args }

  async findById(t: string, id: string) { this.track('findById', [t, id]); return this.result }
  async getMemberIds(t: string, sid: string) { this.track('getMemberIds', [t, sid]); return this.memberIds }
  async addMembers(t: string, sid: string, ids: string[]) { this.track('addMembers', [t, sid, ids]) }
  async removeMembers(t: string, sid: string, ids: string[]) { this.track('removeMembers', [t, sid, ids]) }
  async removeExpiredMembers(t: string, sid: string) { this.track('removeExpiredMembers', [t, sid]); return 0 }
}

class AppUserRepoSpy {
  listResult = { data: [] as AppUserRow[], total: 0 }
  async list(_t: string, _p: unknown) { return this.listResult }
}

describe('SegmentRefreshService (Layer 2)', () => {
  const tenantId = 'tenant-1'
  const segmentId = 'seg-1'
  let segRepo: SegRepoSpy
  let userRepo: AppUserRepoSpy
  let sut: SegmentRefreshService

  const highValueRules: SegmentRuleGroup = {
    operator: 'AND',
    conditions: [
      { field: 'totalSpent', op: 'gte', value: 100 },
      { field: 'pushOptIn', op: 'eq', value: true },
    ],
  }

  function makeSut() {
    segRepo = new SegRepoSpy()
    userRepo = new AppUserRepoSpy()
    sut = new SegmentRefreshService(segRepo as never, userRepo as never)
    segRepo.result = {
      id: segmentId, tenantId, name: 'High Value', description: null,
      rules: highValueRules, userCount: 0, createdAt: new Date(), updatedAt: new Date(),
    }
  }

  beforeEach(() => makeSut())

  it('should add qualifying users', async () => {
    userRepo.listResult = {
      data: [
        makeUser({ id: 'u-1', tenantId, totalSpent: 200, pushOptIn: true }),
        makeUser({ id: 'u-2', tenantId, totalSpent: 50, pushOptIn: true }),
      ],
      total: 2,
    }
    segRepo.memberIds = []
    const result = await sut.refreshSegment(tenantId, segmentId)
    expect(result.added).toBe(1)
    expect(result.removed).toBe(0)
    expect(segRepo.calls.addMembers).toBe(1)
    expect(segRepo.lastArgs.addMembers).toEqual(expect.arrayContaining([tenantId, segmentId, ['u-1']]))
  })

  it('should remove non-qualifying users', async () => {
    userRepo.listResult = { data: [makeUser({ id: 'u-1', tenantId, totalSpent: 50 })], total: 1 }
    segRepo.memberIds = ['u-1']
    const result = await sut.refreshSegment(tenantId, segmentId)
    expect(result.removed).toBe(1)
    expect(segRepo.calls.removeMembers).toBe(1)
  })

  it('should remove expired memberships', async () => {
    userRepo.listResult = { data: [], total: 0 }
    segRepo.memberIds = []
    await sut.refreshSegment(tenantId, segmentId)
    expect(segRepo.calls.removeExpiredMembers).toBe(1)
  })

  it('should be idempotent', async () => {
    userRepo.listResult = { data: [makeUser({ id: 'u-1', tenantId, totalSpent: 200, pushOptIn: true })], total: 1 }
    segRepo.memberIds = ['u-1']
    const result = await sut.refreshSegment(tenantId, segmentId)
    expect(result.added).toBe(0)
    expect(result.removed).toBe(0)
  })

  it('should throw if segment not found', async () => {
    segRepo.result = undefined
    await expect(sut.refreshSegment(tenantId, 'missing')).rejects.toThrow('Segment not found')
  })

  it('should not call addMembers when none qualify', async () => {
    userRepo.listResult = { data: [], total: 0 }
    segRepo.memberIds = []
    await sut.refreshSegment(tenantId, segmentId)
    expect(segRepo.calls.addMembers).toBeUndefined()
  })

  it('should not call removeMembers when none to remove', async () => {
    userRepo.listResult = { data: [makeUser({ id: 'u-1', tenantId, totalSpent: 200, pushOptIn: true })], total: 1 }
    segRepo.memberIds = ['u-1']
    await sut.refreshSegment(tenantId, segmentId)
    expect(segRepo.calls.removeMembers).toBeUndefined()
  })
})
