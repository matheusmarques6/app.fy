import { describe, it, expect } from 'vitest'
import type { DeliveryStatus } from '@appfy/shared'
import { DeliveryNotFoundError } from '../errors.js'
import { DeliveryStatusService } from './delivery-status.service.js'
import type { DeliveryRecord, DeliveryStatusRepository } from './delivery-status.service.js'

// --- Helpers ---

function makeDelivery(overrides: Partial<DeliveryRecord> = {}): DeliveryRecord {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tenantId: overrides.tenantId ?? 'tenant-1',
    notificationId: overrides.notificationId ?? crypto.randomUUID(),
    deviceId: overrides.deviceId ?? crypto.randomUUID(),
    appUserId: overrides.appUserId ?? null,
    status: overrides.status ?? 'pending',
    sentAt: overrides.sentAt ?? null,
    deliveredAt: overrides.deliveredAt ?? null,
    openedAt: overrides.openedAt ?? null,
    clickedAt: overrides.clickedAt ?? null,
    convertedAt: overrides.convertedAt ?? null,
    errorMessage: overrides.errorMessage ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

// --- Spy ---

class DeliveryStatusRepoSpy implements DeliveryStatusRepository {
  findResult: DeliveryRecord | undefined = undefined
  updateResult: DeliveryRecord | null = null
  optimisticLockFails = false
  private _calls = new Map<string, { count: number; lastArgs: unknown[] }>()

  async findById(tenantId: string, id: string): Promise<DeliveryRecord | undefined> {
    this.track('findById', [tenantId, id])
    return this.findResult
  }

  async updateStatusOptimistic(
    tenantId: string,
    id: string,
    fromStatus: DeliveryStatus,
    toStatus: DeliveryStatus,
    timestamp?: Date,
    errorMessage?: string,
  ): Promise<DeliveryRecord | null> {
    this.track('updateStatusOptimistic', [tenantId, id, fromStatus, toStatus, timestamp, errorMessage])
    if (this.optimisticLockFails) return null
    return this.updateResult ?? makeDelivery({
      ...this.findResult,
      status: toStatus,
      errorMessage: errorMessage ?? null,
    })
  }

  private track(method: string, args: unknown[]): void {
    const existing = this._calls.get(method) ?? { count: 0, lastArgs: [] }
    this._calls.set(method, { count: existing.count + 1, lastArgs: args })
  }
  callCount(method: string): number {
    return this._calls.get(method)?.count ?? 0
  }
  wasCalled(method: string): boolean {
    return this.callCount(method) > 0
  }
  lastCallArgs(method: string): unknown[] {
    return this._calls.get(method)?.lastArgs ?? []
  }
}

// --- Tests ---

function makeSut() {
  const repo = new DeliveryStatusRepoSpy()
  const sut = new DeliveryStatusService({ deliveryStatusRepo: repo })
  return { sut, repo }
}

describe('DeliveryStatusService', () => {
  const tenantId = 'tenant-1'
  const deliveryId = 'delivery-1'

  describe('transition', () => {
    it('should transition pending → sent successfully', async () => {
      const { sut, repo } = makeSut()
      repo.findResult = makeDelivery({ id: deliveryId, status: 'pending' })

      const result = await sut.transition(tenantId, deliveryId, 'sent')

      expect(result).not.toBeNull()
      expect(result!.status).toBe('sent')
      expect(repo.wasCalled('updateStatusOptimistic')).toBe(true)
    })

    it('should complete happy path: pending → sent → delivered → opened → clicked → converted', async () => {
      const { sut, repo } = makeSut()
      const statuses: DeliveryStatus[] = ['pending', 'sent', 'delivered', 'opened', 'clicked']
      const nextStatuses: DeliveryStatus[] = ['sent', 'delivered', 'opened', 'clicked', 'converted']

      for (let i = 0; i < statuses.length; i++) {
        repo.findResult = makeDelivery({ id: deliveryId, status: statuses[i]! })
        const result = await sut.transition(tenantId, deliveryId, nextStatuses[i]!)
        expect(result).not.toBeNull()
        expect(result!.status).toBe(nextStatuses[i])
      }
    })

    it('should throw on invalid transition: pending → converted', async () => {
      const { sut, repo } = makeSut()
      repo.findResult = makeDelivery({ id: deliveryId, status: 'pending' })

      await expect(
        sut.transition(tenantId, deliveryId, 'converted'),
      ).rejects.toThrow('Invalid delivery status transition')
    })

    it('should allow failed from any state', async () => {
      const { sut, repo } = makeSut()

      for (const fromStatus of ['pending', 'sent', 'delivered', 'opened', 'clicked', 'converted'] as DeliveryStatus[]) {
        repo.findResult = makeDelivery({ id: deliveryId, status: fromStatus })
        const result = await sut.transition(tenantId, deliveryId, 'failed')
        expect(result).not.toBeNull()
        expect(result!.status).toBe('failed')
      }
    })

    it('should throw DeliveryNotFoundError when delivery does not exist', async () => {
      const { sut, repo } = makeSut()
      repo.findResult = undefined

      await expect(
        sut.transition(tenantId, deliveryId, 'sent'),
      ).rejects.toThrow(DeliveryNotFoundError)
    })

    it('should return null when optimistic lock fails (concurrent update)', async () => {
      const { sut, repo } = makeSut()
      repo.findResult = makeDelivery({ id: deliveryId, status: 'pending' })
      repo.optimisticLockFails = true

      const result = await sut.transition(tenantId, deliveryId, 'sent')

      expect(result).toBeNull()
    })

    it('should pass correct fromStatus to optimistic lock', async () => {
      const { sut, repo } = makeSut()
      repo.findResult = makeDelivery({ id: deliveryId, status: 'sent' })

      await sut.transition(tenantId, deliveryId, 'delivered')

      const [, , fromStatus, toStatus] = repo.lastCallArgs('updateStatusOptimistic')
      expect(fromStatus).toBe('sent')
      expect(toStatus).toBe('delivered')
    })

    it('should pass errorMessage to repository when transitioning to failed', async () => {
      const { sut, repo } = makeSut()
      repo.findResult = makeDelivery({ id: deliveryId, status: 'sent' })

      await sut.transition(tenantId, deliveryId, 'failed', 'OneSignal timeout')

      const [, , , , , errorMessage] = repo.lastCallArgs('updateStatusOptimistic')
      expect(errorMessage).toBe('OneSignal timeout')
    })
  })
})
