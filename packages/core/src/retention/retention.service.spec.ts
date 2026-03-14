import { describe, it, expect } from 'vitest'
import { RetentionService } from './retention.service.js'

// --- Inline spy doubles ---

class CallTracker {
  private calls = new Map<string, { count: number; lastArgs: unknown[] }>()

  track(method: string, args: unknown[]): void {
    const existing = this.calls.get(method) ?? { count: 0, lastArgs: [] }
    this.calls.set(method, { count: existing.count + 1, lastArgs: args })
  }

  callCount(method: string): number {
    return this.calls.get(method)?.count ?? 0
  }

  wasCalled(method: string): boolean {
    return this.callCount(method) > 0
  }

  lastCallArgs(method: string): unknown[] {
    return this.calls.get(method)?.lastArgs ?? []
  }
}

class DeliveryRetentionRepoSpy extends CallTracker {
  deletedCounts: number[] = []
  private callIdx = 0

  async deleteExpiredBefore(date: Date, batchSize: number): Promise<number> {
    this.track('deleteExpiredBefore', [date, batchSize])
    const count = this.deletedCounts[this.callIdx] ?? 0
    this.callIdx++
    return count
  }
}

class EventRetentionRepoSpy extends CallTracker {
  deletedCounts: number[] = []
  private callIdx = 0

  async deleteExpiredBefore(date: Date, batchSize: number): Promise<number> {
    this.track('deleteExpiredBefore', [date, batchSize])
    const count = this.deletedCounts[this.callIdx] ?? 0
    this.callIdx++
    return count
  }
}

// --- Test suite ---

function makeSut() {
  const deliveryRepo = new DeliveryRetentionRepoSpy()
  const eventRepo = new EventRetentionRepoSpy()

  const sut = new RetentionService({
    deliveryRepo,
    eventRepo,
    batchSize: 1000,
  })

  return { sut, deliveryRepo, eventRepo }
}

describe('RetentionService', () => {
  describe('cleanExpiredDeliveries', () => {
    it('should delete deliveries older than 180 days', async () => {
      const { sut, deliveryRepo } = makeSut()
      deliveryRepo.deletedCounts = [0]

      const result = await sut.cleanExpiredDeliveries()

      expect(deliveryRepo.wasCalled('deleteExpiredBefore')).toBe(true)
      const [date, batchSize] = deliveryRepo.lastCallArgs('deleteExpiredBefore') as [Date, number]

      // Verify cutoff is 180 days ago (5s tolerance)
      const expectedCutoff = new Date()
      expectedCutoff.setDate(expectedCutoff.getDate() - 180)
      expect(Math.abs(date.getTime() - expectedCutoff.getTime())).toBeLessThan(5000)
      expect(batchSize).toBe(1000)
      expect(result).toBe(0)
    })

    it('should process multiple batches until no more rows', async () => {
      const { sut, deliveryRepo } = makeSut()
      deliveryRepo.deletedCounts = [1000, 500, 0]

      const result = await sut.cleanExpiredDeliveries()

      expect(deliveryRepo.callCount('deleteExpiredBefore')).toBe(3)
      expect(result).toBe(1500)
    })

    it('should return 0 when nothing to delete', async () => {
      const { sut, deliveryRepo } = makeSut()
      deliveryRepo.deletedCounts = [0]

      const result = await sut.cleanExpiredDeliveries()

      expect(result).toBe(0)
      expect(deliveryRepo.callCount('deleteExpiredBefore')).toBe(1)
    })
  })

  describe('cleanExpiredEvents', () => {
    it('should delete events older than 90 days', async () => {
      const { sut, eventRepo } = makeSut()
      eventRepo.deletedCounts = [0]

      const result = await sut.cleanExpiredEvents()

      expect(eventRepo.wasCalled('deleteExpiredBefore')).toBe(true)
      const [date, batchSize] = eventRepo.lastCallArgs('deleteExpiredBefore') as [Date, number]

      // Verify cutoff is 90 days ago (5s tolerance)
      const expectedCutoff = new Date()
      expectedCutoff.setDate(expectedCutoff.getDate() - 90)
      expect(Math.abs(date.getTime() - expectedCutoff.getTime())).toBeLessThan(5000)
      expect(batchSize).toBe(1000)
      expect(result).toBe(0)
    })

    it('should process multiple batches until no more rows', async () => {
      const { sut, eventRepo } = makeSut()
      eventRepo.deletedCounts = [1000, 1000, 300, 0]

      const result = await sut.cleanExpiredEvents()

      expect(eventRepo.callCount('deleteExpiredBefore')).toBe(4)
      expect(result).toBe(2300)
    })

    it('should return 0 when nothing to delete', async () => {
      const { sut, eventRepo } = makeSut()
      eventRepo.deletedCounts = [0]

      const result = await sut.cleanExpiredEvents()

      expect(result).toBe(0)
      expect(eventRepo.callCount('deleteExpiredBefore')).toBe(1)
    })
  })

  describe('runAll', () => {
    it('should clean both deliveries and events', async () => {
      const { sut, deliveryRepo, eventRepo } = makeSut()
      deliveryRepo.deletedCounts = [100, 0]
      eventRepo.deletedCounts = [50, 0]

      const result = await sut.runAll()

      expect(result).toEqual({
        deliveriesDeleted: 100,
        eventsDeleted: 50,
      })
    })
  })
})
