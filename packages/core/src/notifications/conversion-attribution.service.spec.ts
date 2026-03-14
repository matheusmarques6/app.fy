import { describe, it, expect } from 'vitest'
import { ConversionAttributionService } from './conversion-attribution.service.js'
import type { AttributableDelivery, AttributionRepository } from './conversion-attribution.service.js'

// --- Helpers ---

function makeDelivery(overrides: Partial<AttributableDelivery> & { sentAt: Date }): AttributableDelivery {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    notificationId: overrides.notificationId ?? crypto.randomUUID(),
    appUserId: overrides.appUserId ?? 'user-1',
    status: overrides.status ?? 'sent',
    sentAt: overrides.sentAt,
    convertedAt: overrides.convertedAt ?? null,
  }
}

// --- Spy ---

class AttributionRepoSpy implements AttributionRepository {
  deliveries: AttributableDelivery[] = []
  private _convertedIds: string[] = []

  async findRecentDeliveries(
    _tenantId: string,
    _appUserId: string,
    _withinMs: number,
  ): Promise<AttributableDelivery[]> {
    return this.deliveries
  }

  async markConverted(_tenantId: string, deliveryId: string, _convertedAt: Date): Promise<void> {
    this._convertedIds.push(deliveryId)
  }

  get convertedIds(): string[] {
    return [...this._convertedIds]
  }
}

// --- Tests ---

function makeSut() {
  const repo = new AttributionRepoSpy()
  const sut = new ConversionAttributionService(repo)
  return { sut, repo }
}

describe('ConversionAttributionService', () => {
  const tenantId = 'tenant-1'
  const appUserId = 'user-1'

  describe('attributeConversion', () => {
    it('should attribute purchase 30min after push (within 1h multi-campaign)', async () => {
      const { sut, repo } = makeSut()
      const sentAt = new Date('2026-03-14T10:00:00Z')
      const purchaseTime = new Date('2026-03-14T10:30:00Z') // 30min later

      repo.deliveries = [makeDelivery({ sentAt, id: 'del-1', notificationId: 'notif-1' })]

      const result = await sut.attributeConversion(tenantId, appUserId, purchaseTime, true)

      expect(result.attributed).toBe(true)
      expect(result.deliveryId).toBe('del-1')
      expect(result.notificationId).toBe('notif-1')
      expect(result.windowType).toBe('multi_campaign')
    })

    it('should attribute at exactly 1h boundary (inclusive)', async () => {
      const { sut, repo } = makeSut()
      const sentAt = new Date('2026-03-14T10:00:00Z')
      const purchaseTime = new Date('2026-03-14T11:00:00Z') // exactly 1h

      repo.deliveries = [makeDelivery({ sentAt })]

      const result = await sut.attributeConversion(tenantId, appUserId, purchaseTime, true)

      expect(result.attributed).toBe(true)
    })

    it('should NOT attribute at 1h + 1ms (multi-campaign)', async () => {
      const { sut, repo } = makeSut()
      const sentAt = new Date('2026-03-14T10:00:00.000Z')
      const purchaseTime = new Date('2026-03-14T11:00:00.001Z') // 1h + 1ms

      repo.deliveries = [makeDelivery({ sentAt })]

      const result = await sut.attributeConversion(tenantId, appUserId, purchaseTime, true)

      expect(result.attributed).toBe(false)
    })

    it('should attribute at exactly 24h boundary (normal flow, inclusive)', async () => {
      const { sut, repo } = makeSut()
      const sentAt = new Date('2026-03-13T10:00:00Z')
      const purchaseTime = new Date('2026-03-14T10:00:00Z') // exactly 24h

      repo.deliveries = [makeDelivery({ sentAt })]

      const result = await sut.attributeConversion(tenantId, appUserId, purchaseTime, false)

      expect(result.attributed).toBe(true)
      expect(result.windowType).toBe('normal')
    })

    it('should NOT attribute at 24h + 1ms (normal flow)', async () => {
      const { sut, repo } = makeSut()
      const sentAt = new Date('2026-03-13T10:00:00.000Z')
      const purchaseTime = new Date('2026-03-14T10:00:00.001Z') // 24h + 1ms

      repo.deliveries = [makeDelivery({ sentAt })]

      const result = await sut.attributeConversion(tenantId, appUserId, purchaseTime, false)

      expect(result.attributed).toBe(false)
    })

    it('should attribute to most recent push when multiple within window', async () => {
      const { sut, repo } = makeSut()
      const olderSentAt = new Date('2026-03-14T09:00:00Z')
      const newerSentAt = new Date('2026-03-14T09:30:00Z')
      const purchaseTime = new Date('2026-03-14T09:45:00Z')

      repo.deliveries = [
        makeDelivery({ sentAt: newerSentAt, id: 'del-newer', notificationId: 'notif-newer' }),
        makeDelivery({ sentAt: olderSentAt, id: 'del-older', notificationId: 'notif-older' }),
      ]

      const result = await sut.attributeConversion(tenantId, appUserId, purchaseTime, true)

      expect(result.attributed).toBe(true)
      expect(result.deliveryId).toBe('del-newer')
      expect(result.notificationId).toBe('notif-newer')
    })

    it('should return not attributed when no deliveries exist', async () => {
      const { sut, repo } = makeSut()
      repo.deliveries = []

      const result = await sut.attributeConversion(
        tenantId,
        appUserId,
        new Date(),
        false,
      )

      expect(result.attributed).toBe(false)
    })

    it('should call markConverted with correct deliveryId and purchaseTime', async () => {
      const { sut, repo } = makeSut()
      const sentAt = new Date('2026-03-14T10:00:00Z')
      const purchaseTime = new Date('2026-03-14T10:30:00Z')

      repo.deliveries = [makeDelivery({ sentAt, id: 'del-1' })]

      await sut.attributeConversion(tenantId, appUserId, purchaseTime, true)

      expect(repo.convertedIds).toEqual(['del-1'])
    })

    it('should use 24h window by default (isMultiCampaign = false)', async () => {
      const { sut, repo } = makeSut()
      const sentAt = new Date('2026-03-13T14:00:00Z')
      const purchaseTime = new Date('2026-03-14T12:00:00Z') // 22h later (within 24h)

      repo.deliveries = [makeDelivery({ sentAt })]

      const result = await sut.attributeConversion(tenantId, appUserId, purchaseTime)

      expect(result.attributed).toBe(true)
      expect(result.windowType).toBe('normal')
    })
  })
})
