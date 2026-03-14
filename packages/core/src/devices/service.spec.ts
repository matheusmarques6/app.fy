import type { DevicePlatform } from '@appfy/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { DeviceNotFoundError } from '../errors.js'
import type { AppUserRow, CreateAppUserInput } from '../app-users/repository.js'
import type { DeviceRow, RegisterDeviceInput } from './repository.js'
import { DeviceService } from './service.js'

function makeUser(overrides: Partial<AppUserRow> = {}): AppUserRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tenantId: overrides.tenantId ?? 'tenant-1',
    userIdExternal: null, email: null, name: null,
    pushOptIn: true, lastActiveAt: null,
    totalPurchases: 0, totalSpent: 0,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeDevice(overrides: Partial<DeviceRow> = {}): DeviceRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tenantId: overrides.tenantId ?? 'tenant-1',
    appUserId: overrides.appUserId ?? crypto.randomUUID(),
    deviceToken: overrides.deviceToken ?? `token-${crypto.randomUUID().slice(0, 8)}`,
    platform: overrides.platform ?? 'android',
    osVersion: null, appVersion: null,
    isActive: overrides.isActive ?? true,
    lastSeenAt: null, createdAt: new Date(), updatedAt: new Date(),
  }
}

class DeviceRepoSpy {
  result: DeviceRow | undefined = undefined
  listResult: DeviceRow[] = []
  calls: Record<string, number> = {}
  lastArgs: Record<string, unknown[]> = {}
  private track(m: string, a: unknown[]) { this.calls[m] = (this.calls[m] ?? 0) + 1; this.lastArgs[m] = a }

  async findById(t: string, id: string) { this.track('findById', [t, id]); return this.result }
  async findActiveByUser(t: string, uid: string) { this.track('findActiveByUser', [t, uid]); return this.listResult }
  async register(t: string, input: RegisterDeviceInput): Promise<DeviceRow> {
    this.track('register', [t, input])
    return this.result ?? makeDevice({ tenantId: t, appUserId: input.appUserId, platform: input.platform })
  }
  async deactivate(t: string, id: string) { this.track('deactivate', [t, id]) }
  async deactivateByUserAndPlatform(t: string, uid: string, p: DevicePlatform) {
    this.track('deactivateByUserAndPlatform', [t, uid, p])
  }
}

class AppUserRepoSpy {
  result: AppUserRow | undefined = undefined
  calls: Record<string, number> = {}
  private track(m: string, _a: unknown[]) { this.calls[m] = (this.calls[m] ?? 0) + 1 }

  async findById(t: string, id: string) { this.track('findById', [t, id]); return this.result }
  async create(t: string, input: CreateAppUserInput): Promise<AppUserRow> {
    this.track('create', [t, input]); return this.result ?? makeUser({ tenantId: t })
  }
}

describe('DeviceService (Layer 2)', () => {
  const tenantId = 'tenant-1'
  const userId = 'user-1'
  let deviceRepo: DeviceRepoSpy
  let appUserRepo: AppUserRepoSpy
  let sut: DeviceService

  function makeSut() {
    deviceRepo = new DeviceRepoSpy()
    appUserRepo = new AppUserRepoSpy()
    sut = new DeviceService({ deviceRepo: deviceRepo as never, appUserRepo: appUserRepo as never })
  }

  beforeEach(() => makeSut())

  describe('register', () => {
    it('should register device for existing user', async () => {
      appUserRepo.result = makeUser({ id: userId, tenantId })
      const result = await sut.register(tenantId, { appUserId: userId, deviceToken: 'token-abc', platform: 'android' })
      expect(result).toBeDefined()
      expect(deviceRepo.calls.register).toBe(1)
    })

    it('should create app_user + device when user does not exist', async () => {
      appUserRepo.result = undefined
      await sut.register(tenantId, { appUserId: userId, deviceToken: 'token-new', platform: 'ios' }, { email: 'new@test.com' })
      expect(appUserRepo.calls.findById).toBe(1)
      expect(appUserRepo.calls.create).toBe(1)
      expect(deviceRepo.calls.register).toBe(1)
    })

    it('should deactivate old devices on token rotation (same platform)', async () => {
      appUserRepo.result = makeUser({ id: userId, tenantId })
      await sut.register(tenantId, { appUserId: userId, deviceToken: 'new-token', platform: 'android' })
      expect(deviceRepo.calls.deactivateByUserAndPlatform).toBe(1)
      expect(deviceRepo.lastArgs.deactivateByUserAndPlatform).toEqual([tenantId, userId, 'android'])
    })

    it('should not deactivate when no token provided', async () => {
      appUserRepo.result = makeUser({ id: userId, tenantId })
      await sut.register(tenantId, { appUserId: userId, platform: 'android' })
      expect(deviceRepo.calls.deactivateByUserAndPlatform).toBeUndefined()
    })

    it('should handle 5 concurrent registrations', async () => {
      appUserRepo.result = makeUser({ id: userId, tenantId })
      const regs = Array.from({ length: 5 }, (_, i) =>
        sut.register(tenantId, { appUserId: userId, deviceToken: `token-${i}`, platform: i % 2 === 0 ? 'android' : 'ios' }),
      )
      const results = await Promise.all(regs)
      expect(results).toHaveLength(5)
      expect(deviceRepo.calls.register).toBe(5)
    })
  })

  describe('deactivate', () => {
    it('should deactivate existing device', async () => {
      deviceRepo.result = makeDevice({ id: 'd-1', tenantId })
      await sut.deactivate(tenantId, 'd-1')
      expect(deviceRepo.calls.deactivate).toBe(1)
    })

    it('should throw DeviceNotFoundError', async () => {
      deviceRepo.result = undefined
      await expect(sut.deactivate(tenantId, 'missing')).rejects.toThrow(DeviceNotFoundError)
    })
  })

  describe('findActiveByUser', () => {
    it('should return active devices', async () => {
      deviceRepo.listResult = [makeDevice({ tenantId, appUserId: userId }), makeDevice({ tenantId, appUserId: userId })]
      const result = await sut.findActiveByUser(tenantId, userId)
      expect(result).toHaveLength(2)
    })
  })
})
