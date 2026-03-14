import { describe, it, expect } from 'vitest'
import type { AppEventType, FlowType } from '@appfy/shared'
import { EventProcessorService } from './event-processor.service.js'
import type { EventHistoryLookup } from './event-processor.service.js'
import type { AutomationTriggerService } from '../automations/trigger.service.js'
import type { AppEventRow } from './types.js'

// --- Helpers ---

function makeEvent(overrides: Partial<AppEventRow> = {}): AppEventRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tenantId: overrides.tenantId ?? 'tenant-1',
    appUserId: overrides.appUserId ?? 'user-1',
    eventType: overrides.eventType ?? 'app_opened',
    properties: overrides.properties ?? null,
    createdAt: overrides.createdAt ?? new Date(),
  }
}

// --- Spies ---

class TriggerServiceSpy {
  private _calls: Array<{ tenantId: string; flowType: FlowType; userId: string }> = []
  triggerResult: string | null = 'job-1'

  async trigger(tenantId: string, flowType: FlowType, targetUserId: string): Promise<string | null> {
    this._calls.push({ tenantId, flowType, userId: targetUserId })
    return this.triggerResult
  }

  get calls() {
    return [...this._calls]
  }

  wasCalledWith(flowType: FlowType): boolean {
    return this._calls.some((c) => c.flowType === flowType)
  }

  callCount(): number {
    return this._calls.length
  }
}

class EventHistorySpy implements EventHistoryLookup {
  hasAnyEventResult = false
  hasEventWithinWindowResult = false

  async hasAnyEvent(
    _tenantId: string,
    _appUserId: string,
    _eventType: AppEventType,
  ): Promise<boolean> {
    return this.hasAnyEventResult
  }

  async hasEventWithinWindow(
    _tenantId: string,
    _appUserId: string,
    _eventType: AppEventType,
    _windowSeconds: number,
  ): Promise<boolean> {
    return this.hasEventWithinWindowResult
  }
}

// --- Tests ---

function makeSut() {
  const triggerService = new TriggerServiceSpy()
  const eventHistory = new EventHistorySpy()
  const sut = new EventProcessorService({
    triggerService: triggerService as unknown as AutomationTriggerService,
    eventHistory,
  })
  return { sut, triggerService, eventHistory }
}

describe('EventProcessorService', () => {
  const tenantId = 'tenant-1'

  describe('app_opened → welcome', () => {
    it('should trigger welcome on first app_opened', async () => {
      const { sut, triggerService, eventHistory } = makeSut()
      eventHistory.hasAnyEventResult = false // no previous app_opened

      const result = await sut.process(tenantId, makeEvent({ eventType: 'app_opened' }))

      expect(result).toBe('job-1')
      expect(triggerService.wasCalledWith('welcome')).toBe(true)
    })

    it('should NOT trigger welcome on second app_opened', async () => {
      const { sut, triggerService, eventHistory } = makeSut()
      eventHistory.hasAnyEventResult = true // previous app_opened exists

      const result = await sut.process(tenantId, makeEvent({ eventType: 'app_opened' }))

      expect(result).toBeNull()
      expect(triggerService.callCount()).toBe(0)
    })
  })

  describe('product_viewed → browse_abandoned', () => {
    it('should schedule browse_abandoned check on product_viewed without recent add_to_cart', async () => {
      const { sut, triggerService, eventHistory } = makeSut()
      eventHistory.hasEventWithinWindowResult = false // no add_to_cart

      const result = await sut.process(
        tenantId,
        makeEvent({ eventType: 'product_viewed', properties: { productId: 'prod-1' } }),
      )

      expect(result).toBe('job-1')
      expect(triggerService.wasCalledWith('browse_abandoned')).toBe(true)
    })

    it('should NOT schedule browse_abandoned if user has recent add_to_cart', async () => {
      const { sut, triggerService, eventHistory } = makeSut()
      eventHistory.hasEventWithinWindowResult = true // has recent add_to_cart

      const result = await sut.process(
        tenantId,
        makeEvent({ eventType: 'product_viewed' }),
      )

      expect(result).toBeNull()
      expect(triggerService.callCount()).toBe(0)
    })
  })

  describe('purchase_completed → upsell', () => {
    it('should trigger upsell on purchase_completed', async () => {
      const { sut, triggerService } = makeSut()

      const result = await sut.process(
        tenantId,
        makeEvent({ eventType: 'purchase_completed' }),
      )

      expect(result).toBe('job-1')
      expect(triggerService.wasCalledWith('upsell')).toBe(true)
    })
  })

  describe('unmapped events', () => {
    it('should return null for add_to_cart (no direct automation)', async () => {
      const { sut, triggerService } = makeSut()

      const result = await sut.process(tenantId, makeEvent({ eventType: 'add_to_cart' }))

      expect(result).toBeNull()
      expect(triggerService.callCount()).toBe(0)
    })

    it('should return null for push_opened (no direct automation)', async () => {
      const { sut, triggerService } = makeSut()

      const result = await sut.process(tenantId, makeEvent({ eventType: 'push_opened' }))

      expect(result).toBeNull()
      expect(triggerService.callCount()).toBe(0)
    })

    it('should return null for push_clicked (no direct automation)', async () => {
      const { sut, triggerService } = makeSut()

      const result = await sut.process(tenantId, makeEvent({ eventType: 'push_clicked' }))

      expect(result).toBeNull()
      expect(triggerService.callCount()).toBe(0)
    })
  })

  describe('disabled automation', () => {
    it('should return null when trigger service returns null (disabled)', async () => {
      const { sut, triggerService, eventHistory } = makeSut()
      triggerService.triggerResult = null // disabled flow
      eventHistory.hasAnyEventResult = false

      const result = await sut.process(tenantId, makeEvent({ eventType: 'app_opened' }))

      expect(result).toBeNull()
    })
  })
})
