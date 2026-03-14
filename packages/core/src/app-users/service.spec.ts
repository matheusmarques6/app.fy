import { beforeEach, describe, expect, it } from 'vitest'
import { AppUserNotFoundError, DomainError } from '../errors.js'
import type { AppUserRow, CreateAppUserInput, UpdateAppUserInput } from './repository.js'
import { AppUserService } from './service.js'

/** Inline spy for AppUserRepository — avoids circular dep on test-utils */
class AppUserRepoSpy {
  result: AppUserRow | undefined = undefined
  listResult: { data: AppUserRow[]; total: number } = { data: [], total: 0 }
  calls: Record<string, number> = {}
  lastArgs: Record<string, unknown[]> = {}

  private track(m: string, args: unknown[]) {
    this.calls[m] = (this.calls[m] ?? 0) + 1
    this.lastArgs[m] = args
  }

  async findById(tenantId: string, id: string) {
    this.track('findById', [tenantId, id])
    return this.result
  }
  async findByExternalId(tenantId: string, externalId: string) {
    this.track('findByExternalId', [tenantId, externalId])
    return this.result
  }
  async create(tenantId: string, input: CreateAppUserInput): Promise<AppUserRow> {
    this.track('create', [tenantId, input])
    return this.result ?? makeUser({ tenantId, email: input.email ?? null })
  }
  async upsertByExternalId(tenantId: string, externalId: string, input: CreateAppUserInput): Promise<AppUserRow> {
    this.track('upsertByExternalId', [tenantId, externalId, input])
    return this.result ?? makeUser({ tenantId, userIdExternal: externalId })
  }
  async update(tenantId: string, id: string, _input: UpdateAppUserInput): Promise<AppUserRow> {
    this.track('update', [tenantId, id, _input])
    return this.result ?? makeUser({ tenantId, id })
  }
  async updatePushOptIn(tenantId: string, id: string, optIn: boolean) {
    this.track('updatePushOptIn', [tenantId, id, optIn])
  }
  async list(tenantId: string, pagination: unknown) {
    this.track('list', [tenantId, pagination])
    return this.listResult
  }
}

function makeUser(overrides: Partial<AppUserRow> = {}): AppUserRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tenantId: overrides.tenantId ?? 'tenant-1',
    userIdExternal: overrides.userIdExternal ?? null,
    email: overrides.email ?? null,
    name: overrides.name ?? null,
    pushOptIn: overrides.pushOptIn ?? true,
    lastActiveAt: null,
    totalPurchases: overrides.totalPurchases ?? 0,
    totalSpent: overrides.totalSpent ?? 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('AppUserService (Layer 2)', () => {
  const tenantId = 'tenant-1'
  let repo: AppUserRepoSpy
  let sut: AppUserService

  function makeSut() {
    repo = new AppUserRepoSpy()
    sut = new AppUserService(repo as never)
  }

  beforeEach(() => makeSut())

  describe('register', () => {
    it('should create app user with valid input', async () => {
      const result = await sut.register(tenantId, { email: 'user@test.com', name: 'Test' })
      expect(result).toBeDefined()
      expect(repo.calls.create).toBe(1)
    })

    it('should upsert when externalId is provided', async () => {
      await sut.register(tenantId, { userIdExternal: 'ext-123', email: 'user@test.com' })
      expect(repo.calls.upsertByExternalId).toBe(1)
      expect(repo.calls.create).toBeUndefined()
    })

    it('should call create when externalId is not provided', async () => {
      await sut.register(tenantId, { email: 'user@test.com' })
      expect(repo.calls.create).toBe(1)
      expect(repo.calls.upsertByExternalId).toBeUndefined()
    })

    it('should throw DomainError for invalid email', async () => {
      await expect(sut.register(tenantId, { email: 'not-valid' })).rejects.toThrow(DomainError)
    })

    it('should throw DomainError for name too long', async () => {
      await expect(sut.register(tenantId, { name: 'a'.repeat(256) })).rejects.toThrow(DomainError)
    })

    it('should allow registration with minimal data', async () => {
      const result = await sut.register(tenantId, {})
      expect(result).toBeDefined()
    })

    it('should handle duplicate external_id (upsert)', async () => {
      repo.result = makeUser({ tenantId, userIdExternal: 'ext-1' })
      const result = await sut.register(tenantId, { userIdExternal: 'ext-1', email: 'new@test.com' })
      expect(result).toBeDefined()
      expect(repo.calls.upsertByExternalId).toBe(1)
    })
  })

  describe('findById', () => {
    it('should return user when found', async () => {
      repo.result = makeUser({ id: 'u-1', tenantId })
      const result = await sut.findById(tenantId, 'u-1')
      expect(result.id).toBe('u-1')
    })

    it('should throw AppUserNotFoundError when not found', async () => {
      repo.result = undefined
      await expect(sut.findById(tenantId, 'missing')).rejects.toThrow(AppUserNotFoundError)
    })
  })

  describe('findByExternalId', () => {
    it('should return user when found', async () => {
      repo.result = makeUser({ userIdExternal: 'ext-1', tenantId })
      const result = await sut.findByExternalId(tenantId, 'ext-1')
      expect(result.userIdExternal).toBe('ext-1')
    })

    it('should throw when not found', async () => {
      repo.result = undefined
      await expect(sut.findByExternalId(tenantId, 'ext-missing')).rejects.toThrow(AppUserNotFoundError)
    })
  })

  describe('update', () => {
    it('should update existing user', async () => {
      repo.result = makeUser({ id: 'u-1', tenantId })
      const result = await sut.update(tenantId, 'u-1', { email: 'new@test.com' })
      expect(result).toBeDefined()
      expect(repo.calls.update).toBe(1)
    })

    it('should throw if user not found', async () => {
      repo.result = undefined
      await expect(sut.update(tenantId, 'missing', { name: 'X' })).rejects.toThrow(AppUserNotFoundError)
    })

    it('should validate update input', async () => {
      repo.result = makeUser({ id: 'u-1', tenantId })
      await expect(sut.update(tenantId, 'u-1', { email: 'bad' })).rejects.toThrow(DomainError)
    })
  })

  describe('updatePushOptIn', () => {
    it('should update push opt-in status', async () => {
      repo.result = makeUser({ id: 'u-1', tenantId })
      await sut.updatePushOptIn(tenantId, 'u-1', false)
      expect(repo.calls.updatePushOptIn).toBe(1)
      expect(repo.lastArgs.updatePushOptIn).toEqual([tenantId, 'u-1', false])
    })
  })

  describe('list', () => {
    it('should return paginated response', async () => {
      repo.listResult = { data: [makeUser({ tenantId }), makeUser({ tenantId })], total: 2 }
      const result = await sut.list(tenantId, { page: 1, perPage: 10 })
      expect(result.data).toHaveLength(2)
      expect(result.meta.total).toBe(2)
    })

    it('should use default pagination', async () => {
      repo.listResult = { data: [], total: 0 }
      const result = await sut.list(tenantId)
      expect(result.meta.page).toBe(1)
      expect(result.meta.perPage).toBe(20)
    })
  })
})
