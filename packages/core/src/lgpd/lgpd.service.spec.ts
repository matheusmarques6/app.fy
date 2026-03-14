import { describe, it, expect } from 'vitest'
import { LGPDService, type LGPDRepos, type LGPDRepoFactory } from './lgpd.service.js'
import { AppUserNotFoundError } from '../errors.js'

// --- Inline spy doubles (core tests don't import from test-utils) ---

class CallTracker {
  private calls = new Map<string, { count: number; lastArgs: unknown[] }>()

  track(method: string, args: unknown[]): void {
    const existing = this.calls.get(method) ?? { count: 0, lastArgs: [] }
    this.calls.set(method, { count: existing.count + 1, lastArgs: args })
  }

  wasCalled(method: string): boolean {
    return (this.calls.get(method)?.count ?? 0) > 0
  }

  lastCallArgs(method: string): unknown[] {
    return this.calls.get(method)?.lastArgs ?? []
  }
}

class AppUserRepoSpy extends CallTracker {
  result: { id: string; tenantId: string } | undefined = { id: 'user-1', tenantId: 't-1' }

  async findById(tenantId: string, id: string): Promise<{ id: string; tenantId: string } | undefined> {
    this.track('findById', [tenantId, id])
    return this.result
  }

  async updatePushOptIn(tenantId: string, id: string, optIn: boolean) {
    this.track('updatePushOptIn', [tenantId, id, optIn])
  }

  async delete(tenantId: string, id: string) {
    this.track('delete', [tenantId, id])
  }
}

class EventRepoSpy extends CallTracker {
  async deleteByAppUser(tenantId: string, appUserId: string) {
    this.track('deleteByAppUser', [tenantId, appUserId])
    return 5
  }
}

class SegmentRepoSpy extends CallTracker {
  async removeMemberFromAll(tenantId: string, appUserId: string) {
    this.track('removeMemberFromAll', [tenantId, appUserId])
    return 3
  }
}

class ProductRepoSpy extends CallTracker {
  async deleteByAppUser(tenantId: string, appUserId: string) {
    this.track('deleteByAppUser', [tenantId, appUserId])
    return 2
  }
}

class DeviceRepoSpy extends CallTracker {
  async deleteByAppUser(tenantId: string, appUserId: string) {
    this.track('deleteByAppUser', [tenantId, appUserId])
    return 3
  }
}

class DeliveryRepoSpy extends CallTracker {
  anonymizedCount = 4

  async anonymizeByAppUser(tenantId: string, appUserId: string) {
    this.track('anonymizeByAppUser', [tenantId, appUserId])
    return this.anonymizedCount
  }
}

class AuditLogSpy extends CallTracker {
  async log(
    tenantId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ) {
    this.track('log', [tenantId, action, entityType, entityId, metadata])
  }
}

// --- Test suite ---

function makeSut() {
  const appUserRepo = new AppUserRepoSpy()
  const auditLog = new AuditLogSpy()

  // Transaction-scoped repos (separate instances to verify tx is used)
  const txEventRepo = new EventRepoSpy()
  const txSegmentRepo = new SegmentRepoSpy()
  const txProductRepo = new ProductRepoSpy()
  const txDeviceRepo = new DeviceRepoSpy()
  const txDeliveryRepo = new DeliveryRepoSpy()
  const txAppUserRepo = new AppUserRepoSpy()
  txAppUserRepo.result = { id: 'user-1', tenantId: 't-1' }
  const txAuditLog = new AuditLogSpy()

  let receivedTx: unknown = null

  const repoFactory: LGPDRepoFactory = {
    createTransactional(tx: unknown): LGPDRepos {
      receivedTx = tx
      return {
        appUserRepo: txAppUserRepo,
        eventRepo: txEventRepo,
        segmentRepo: txSegmentRepo,
        productRepo: txProductRepo,
        deviceRepo: txDeviceRepo,
        deliveryRepo: txDeliveryRepo,
        auditLog: txAuditLog,
      }
    },
  }

  const txSentinel = Symbol('drizzle-tx')
  const runTransaction = async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
    return fn(txSentinel)
  }

  const sut = new LGPDService({
    appUserRepo,
    auditLog,
    repoFactory,
    runTransaction,
  })

  return {
    sut,
    appUserRepo,
    auditLog,
    txEventRepo,
    txSegmentRepo,
    txProductRepo,
    txDeviceRepo,
    txDeliveryRepo,
    txAppUserRepo,
    txAuditLog,
    txSentinel,
    getReceivedTx: () => receivedTx,
  }
}

describe('LGPDService', () => {
  describe('updatePushOptIn', () => {
    it('should update push_opt_in to false and log audit', async () => {
      const { sut, appUserRepo, auditLog } = makeSut()

      await sut.updatePushOptIn('t-1', 'user-1', false)

      expect(appUserRepo.wasCalled('findById')).toBe(true)
      expect(appUserRepo.lastCallArgs('updatePushOptIn')).toEqual(['t-1', 'user-1', false])
      expect(auditLog.wasCalled('log')).toBe(true)
      expect(auditLog.lastCallArgs('log')).toEqual([
        't-1',
        'lgpd.push_opt_out',
        'app_user',
        'user-1',
        { optIn: false },
      ])
    })

    it('should update push_opt_in to true and log audit', async () => {
      const { sut, appUserRepo, auditLog } = makeSut()

      await sut.updatePushOptIn('t-1', 'user-1', true)

      expect(appUserRepo.lastCallArgs('updatePushOptIn')).toEqual(['t-1', 'user-1', true])
      expect(auditLog.lastCallArgs('log')).toEqual([
        't-1',
        'lgpd.push_opt_in',
        'app_user',
        'user-1',
        { optIn: true },
      ])
    })

    it('should throw AppUserNotFoundError when user does not exist', async () => {
      const { sut, appUserRepo } = makeSut()
      appUserRepo.result = undefined

      await expect(sut.updatePushOptIn('t-1', 'nonexistent', true)).rejects.toThrow(
        AppUserNotFoundError,
      )
    })
  })

  describe('deleteUserData', () => {
    it('should pass tx to repo factory and use transaction-scoped repos', async () => {
      const { sut, getReceivedTx, txSentinel, txEventRepo } = makeSut()

      await sut.deleteUserData('t-1', 'user-1')

      // Verify tx was passed to the repo factory
      expect(getReceivedTx()).toBe(txSentinel)
      // Verify transaction-scoped repos were called (not the outer ones)
      expect(txEventRepo.wasCalled('deleteByAppUser')).toBe(true)
    })

    it('should delete all user data in transaction and log audit', async () => {
      const { sut, txEventRepo, txSegmentRepo, txProductRepo, txDeviceRepo, txDeliveryRepo, txAppUserRepo, txAuditLog } = makeSut()

      await sut.deleteUserData('t-1', 'user-1')

      // All tx-scoped repos called
      expect(txEventRepo.wasCalled('deleteByAppUser')).toBe(true)
      expect(txEventRepo.lastCallArgs('deleteByAppUser')).toEqual(['t-1', 'user-1'])

      expect(txSegmentRepo.wasCalled('removeMemberFromAll')).toBe(true)
      expect(txSegmentRepo.lastCallArgs('removeMemberFromAll')).toEqual(['t-1', 'user-1'])

      expect(txProductRepo.wasCalled('deleteByAppUser')).toBe(true)
      expect(txProductRepo.lastCallArgs('deleteByAppUser')).toEqual(['t-1', 'user-1'])

      expect(txDeviceRepo.wasCalled('deleteByAppUser')).toBe(true)
      expect(txDeviceRepo.lastCallArgs('deleteByAppUser')).toEqual(['t-1', 'user-1'])

      // Deliveries are ANONYMIZED (not deleted)
      expect(txDeliveryRepo.wasCalled('anonymizeByAppUser')).toBe(true)
      expect(txDeliveryRepo.lastCallArgs('anonymizeByAppUser')).toEqual(['t-1', 'user-1'])

      // App user deleted last
      expect(txAppUserRepo.wasCalled('delete')).toBe(true)
      expect(txAppUserRepo.lastCallArgs('delete')).toEqual(['t-1', 'user-1'])

      // Audit logged with deliveriesAnonymized flag (within transaction)
      expect(txAuditLog.wasCalled('log')).toBe(true)
      const [tenantId, action, entityType, entityId, metadata] = txAuditLog.lastCallArgs('log') as [string, string, string, string, Record<string, unknown>]
      expect(tenantId).toBe('t-1')
      expect(action).toBe('lgpd.user_data_deleted')
      expect(entityType).toBe('app_user')
      expect(entityId).toBe('user-1')
      expect(metadata.deliveriesAnonymized).toBe(true)
      expect(metadata.anonymizedDeliveryCount).toBe(4)
    })

    it('should throw AppUserNotFoundError when user does not exist', async () => {
      const { sut, appUserRepo } = makeSut()
      appUserRepo.result = undefined

      await expect(sut.deleteUserData('t-1', 'nonexistent')).rejects.toThrow(
        AppUserNotFoundError,
      )
    })

    it('should return deletion summary', async () => {
      const { sut } = makeSut()

      const result = await sut.deleteUserData('t-1', 'user-1')

      expect(result).toEqual({
        eventsDeleted: 5,
        segmentsRemoved: 3,
        productsDeleted: 2,
        devicesDeleted: 3,
        deliveriesAnonymized: 4,
      })
    })
  })
})
