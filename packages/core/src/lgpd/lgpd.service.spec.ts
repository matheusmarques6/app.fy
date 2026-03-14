import { describe, it, expect } from 'vitest'
import { LGPDService } from './lgpd.service.js'
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

class TransactionSpy extends CallTracker {
  async transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    this.track('transaction', [])
    return fn(undefined)
  }
}

// --- Test suite ---

function makeSut() {
  const appUserRepo = new AppUserRepoSpy()
  const eventRepo = new EventRepoSpy()
  const segmentRepo = new SegmentRepoSpy()
  const productRepo = new ProductRepoSpy()
  const deviceRepo = new DeviceRepoSpy()
  const deliveryRepo = new DeliveryRepoSpy()
  const auditLog = new AuditLogSpy()
  const transactionRunner = new TransactionSpy()

  const sut = new LGPDService({
    appUserRepo,
    eventRepo,
    segmentRepo,
    productRepo,
    deviceRepo,
    deliveryRepo,
    auditLog,
    transactionRunner,
  })

  return {
    sut,
    appUserRepo,
    eventRepo,
    segmentRepo,
    productRepo,
    deviceRepo,
    deliveryRepo,
    auditLog,
    transactionRunner,
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
    it('should delete all user data in transaction and log audit', async () => {
      const { sut, eventRepo, segmentRepo, productRepo, deviceRepo, deliveryRepo, appUserRepo, auditLog, transactionRunner } = makeSut()

      await sut.deleteUserData('t-1', 'user-1')

      // Transaction was used
      expect(transactionRunner.wasCalled('transaction')).toBe(true)

      // All repos called
      expect(eventRepo.wasCalled('deleteByAppUser')).toBe(true)
      expect(eventRepo.lastCallArgs('deleteByAppUser')).toEqual(['t-1', 'user-1'])

      expect(segmentRepo.wasCalled('removeMemberFromAll')).toBe(true)
      expect(segmentRepo.lastCallArgs('removeMemberFromAll')).toEqual(['t-1', 'user-1'])

      expect(productRepo.wasCalled('deleteByAppUser')).toBe(true)
      expect(productRepo.lastCallArgs('deleteByAppUser')).toEqual(['t-1', 'user-1'])

      expect(deviceRepo.wasCalled('deleteByAppUser')).toBe(true)
      expect(deviceRepo.lastCallArgs('deleteByAppUser')).toEqual(['t-1', 'user-1'])

      // Deliveries are ANONYMIZED (not deleted)
      expect(deliveryRepo.wasCalled('anonymizeByAppUser')).toBe(true)
      expect(deliveryRepo.lastCallArgs('anonymizeByAppUser')).toEqual(['t-1', 'user-1'])

      // App user deleted last
      expect(appUserRepo.wasCalled('delete')).toBe(true)
      expect(appUserRepo.lastCallArgs('delete')).toEqual(['t-1', 'user-1'])

      // Audit logged with deliveriesAnonymized flag
      expect(auditLog.wasCalled('log')).toBe(true)
      const [tenantId, action, entityType, entityId, metadata] = auditLog.lastCallArgs('log') as [string, string, string, string, Record<string, unknown>]
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
