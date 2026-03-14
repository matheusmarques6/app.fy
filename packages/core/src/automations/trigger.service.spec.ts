import type { FlowType } from '@appfy/shared'
import { flowTypes } from '@appfy/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AutomationConfigRow } from './repository.js'
import { AutomationTriggerService, DEFAULT_DELAYS } from './trigger.service.js'

function makeConfig(overrides: Partial<AutomationConfigRow> = {}): AutomationConfigRow {
  return {
    id: crypto.randomUUID(),
    tenantId: overrides.tenantId ?? 'tenant-1',
    flowType: overrides.flowType ?? 'cart_abandoned',
    isEnabled: overrides.isEnabled ?? true,
    delaySeconds: overrides.delaySeconds ?? 3600,
    templateTitle: overrides.templateTitle ?? 'Title',
    templateBody: overrides.templateBody ?? 'Body',
    createdAt: new Date(), updatedAt: new Date(),
  }
}

interface Job { name: string; data: unknown; opts: Record<string, unknown> | undefined }

class QueueSpy {
  jobs: Job[] = []
  calls = 0
  async add(name: string, data: unknown, opts?: Record<string, unknown>) {
    this.calls++
    this.jobs.push({ name, data, opts })
    return { id: crypto.randomUUID() }
  }
}

describe('AutomationTriggerService (Layer 2)', () => {
  const tenantId = 'tenant-1'
  const userId = 'user-1'
  let queue: QueueSpy
  let configs: Map<string, AutomationConfigRow | undefined>
  let sut: AutomationTriggerService

  function makeSut() {
    queue = new QueueSpy()
    configs = new Map()
    sut = new AutomationTriggerService(queue, async (_t, ft) => configs.get(ft))
  }

  beforeEach(() => makeSut())

  function setConfig(flowType: FlowType, overrides: Partial<AutomationConfigRow> = {}) {
    configs.set(flowType, makeConfig({
      tenantId, flowType,
      delaySeconds: DEFAULT_DELAYS[flowType],
      templateTitle: `Default ${flowType} title`,
      templateBody: `Default ${flowType} body`,
      ...overrides,
    }))
  }

  // 4 tests per flow x 9 flows = 36 tests
  for (const flowType of flowTypes) {
    describe(`Flow: ${flowType}`, () => {
      it('should create delayed job when triggered', async () => {
        setConfig(flowType)
        const jobId = await sut.trigger(tenantId, flowType, userId)
        expect(jobId).toBeDefined()
        expect(queue.calls).toBe(1)
        expect(queue.jobs[0]!.data).toEqual(expect.objectContaining({ tenantId, flowType, targetUserId: userId }))
        expect(queue.jobs[0]!.opts).toEqual(expect.objectContaining({ delay: DEFAULT_DELAYS[flowType] * 1000 }))
      })

      it('should NOT create job when is_enabled = false', async () => {
        setConfig(flowType, { isEnabled: false })
        expect(await sut.trigger(tenantId, flowType, userId)).toBeNull()
        expect(queue.calls).toBe(0)
      })

      it('should use custom delay', async () => {
        setConfig(flowType, { delaySeconds: 7200 })
        await sut.trigger(tenantId, flowType, userId)
        expect(queue.jobs[0]!.opts).toEqual(expect.objectContaining({ delay: 7200000 }))
      })

      it('should use custom template', async () => {
        setConfig(flowType, { templateTitle: 'Custom {{customer_name}}', templateBody: 'Custom body' })
        await sut.trigger(tenantId, flowType, userId)
        const data = queue.jobs[0]!.data as { templateData: { title: string; body: string } }
        expect(data.templateData.title).toBe('Custom {{customer_name}}')
        expect(data.templateData.body).toBe('Custom body')
      })
    })
  }

  describe('edge cases', () => {
    it('should return null when config does not exist', async () => {
      expect(await sut.trigger(tenantId, 'cart_abandoned', userId)).toBeNull()
    })

    it('should include notificationId when provided', async () => {
      setConfig('order_confirmed')
      await sut.trigger(tenantId, 'order_confirmed', userId, 'notif-123')
      expect((queue.jobs[0]!.data as { notificationId: string }).notificationId).toBe('notif-123')
    })

    it('should set retry config', async () => {
      setConfig('welcome')
      await sut.trigger(tenantId, 'welcome', userId)
      expect(queue.jobs[0]!.opts).toEqual(expect.objectContaining({ attempts: 3, backoff: { type: 'exponential', delay: 5000 } }))
    })
  })

  describe('DEFAULT_DELAYS', () => {
    it('cart_abandoned = 3600s', () => expect(DEFAULT_DELAYS.cart_abandoned).toBe(3600))
    it('pix_recovery = 1800s', () => expect(DEFAULT_DELAYS.pix_recovery).toBe(1800))
    it('boleto_recovery = 3600s', () => expect(DEFAULT_DELAYS.boleto_recovery).toBe(3600))
    it('welcome = 300s', () => expect(DEFAULT_DELAYS.welcome).toBe(300))
    it('checkout_abandoned = 3600s', () => expect(DEFAULT_DELAYS.checkout_abandoned).toBe(3600))
    it('order_confirmed = 0', () => expect(DEFAULT_DELAYS.order_confirmed).toBe(0))
    it('tracking_created = 0', () => expect(DEFAULT_DELAYS.tracking_created).toBe(0))
    it('browse_abandoned = 7200s', () => expect(DEFAULT_DELAYS.browse_abandoned).toBe(7200))
    it('upsell = 259200s', () => expect(DEFAULT_DELAYS.upsell).toBe(259200))
  })
})
