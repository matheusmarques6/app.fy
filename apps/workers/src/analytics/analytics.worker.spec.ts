import type { Dependencies, AnalyticsQueuePayload, AnalyticsOverview } from '@appfy/core'
import type { Job } from 'bullmq'
import { describe, expect, it } from 'vitest'
import { createAnalyticsProcessor } from './analytics.worker.js'

// ──────────────────────────────────────────────
// Spies
// ──────────────────────────────────────────────

class AnalyticsServiceSpy {
  aggregateCalls: Array<{ tenantId: string; period: { from: Date; to: Date } }> = []
  aggregateResult: AnalyticsOverview = {
    totalSent: 100,
    totalDelivered: 90,
    totalOpened: 45,
    totalClicked: 10,
    totalConverted: 2,
    deliveryRate: 0.9,
    openRate: 0.5,
    clickRate: 0.22,
    conversionRate: 0.2,
  }
  aggregateError: Error | null = null

  async aggregate(tenantId: string, period: { from: Date; to: Date }) {
    this.aggregateCalls.push({ tenantId, period })
    if (this.aggregateError) throw this.aggregateError
    return this.aggregateResult
  }
}

class LoggerSpy {
  infos: Array<{ msg: string; meta: Record<string, unknown> }> = []
  warns: Array<{ msg: string; meta: Record<string, unknown> }> = []
  errors: Array<{ msg: string; meta: Record<string, unknown> }> = []

  info(msg: string, meta: Record<string, unknown> = {}) {
    this.infos.push({ msg, meta })
  }
  warn(msg: string, meta: Record<string, unknown> = {}) {
    this.warns.push({ msg, meta })
  }
  error(msg: string, meta: Record<string, unknown> = {}) {
    this.errors.push({ msg, meta })
  }
}

function makeJob(data: Partial<AnalyticsQueuePayload> = {}): Job<AnalyticsQueuePayload> {
  return {
    id: 'job-1',
    data: {
      tenantId: 'tenant-1',
      metricType: 'push_sent',
      period: { from: '2026-01-01T00:00:00Z', to: '2026-01-31T23:59:59Z' },
      ...data,
    },
  } as unknown as Job<AnalyticsQueuePayload>
}

function makeSut() {
  const analyticsService = new AnalyticsServiceSpy()
  const logger = new LoggerSpy()
  const deps = { analyticsService } as unknown as Dependencies
  const processor = createAnalyticsProcessor(deps, logger as unknown as import('../shared/logger.js').Logger)
  return { processor, analyticsService, logger }
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('Analytics Worker Processor', () => {
  describe('validation', () => {
    it('should throw when tenantId is missing', async () => {
      const { processor } = makeSut()
      const job = makeJob({ tenantId: '' })

      await expect(processor(job)).rejects.toThrow('requires tenantId and metricType')
    })

    it('should throw when metricType is missing', async () => {
      const { processor } = makeSut()
      const job = makeJob({ metricType: '' })

      await expect(processor(job)).rejects.toThrow('requires tenantId and metricType')
    })

    it('should throw when period.from is missing', async () => {
      const { processor } = makeSut()
      const job = makeJob({ period: { from: '', to: '2026-01-31' } })

      await expect(processor(job)).rejects.toThrow('requires period.from and period.to')
    })

    it('should throw when period.to is missing', async () => {
      const { processor } = makeSut()
      const job = makeJob({ period: { from: '2026-01-01', to: '' } })

      await expect(processor(job)).rejects.toThrow('requires period.from and period.to')
    })
  })

  describe('metric type validation', () => {
    it('should warn on unknown metric type', async () => {
      const { processor, logger } = makeSut()
      const job = makeJob({ metricType: 'unknown_metric' })

      await processor(job)

      expect(logger.warns).toHaveLength(1)
      expect(logger.warns[0].msg).toContain('Unknown metric type')
    })

    it('should not warn on known metric type', async () => {
      const { processor, logger } = makeSut()
      const job = makeJob({ metricType: 'push_sent' })

      await processor(job)

      expect(logger.warns).toHaveLength(0)
    })
  })

  describe('aggregation', () => {
    it('should call analyticsService.aggregate with parsed period', async () => {
      const { processor, analyticsService } = makeSut()
      const job = makeJob()

      await processor(job)

      expect(analyticsService.aggregateCalls).toHaveLength(1)
      expect(analyticsService.aggregateCalls[0].tenantId).toBe('tenant-1')
      expect(analyticsService.aggregateCalls[0].period.from).toBeInstanceOf(Date)
      expect(analyticsService.aggregateCalls[0].period.to).toBeInstanceOf(Date)
    })

    it('should log completion with metrics', async () => {
      const { processor, logger } = makeSut()
      const job = makeJob()

      await processor(job)

      const completionLog = logger.infos.find((l) => l.msg.includes('completed'))
      expect(completionLog).toBeDefined()
      expect(completionLog!.meta.totalSent).toBe(100)
      expect(completionLog!.meta.deliveryRate).toBe(0.9)
    })

    it('should propagate service errors', async () => {
      const { processor, analyticsService } = makeSut()
      analyticsService.aggregateError = new Error('DB connection failed')
      const job = makeJob()

      await expect(processor(job)).rejects.toThrow('DB connection failed')
    })
  })

  describe('division by zero', () => {
    it('should handle zero counts gracefully', async () => {
      const { processor, analyticsService, logger } = makeSut()
      analyticsService.aggregateResult = {
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalConverted: 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
        conversionRate: 0,
      }
      const job = makeJob()

      await processor(job)

      const completionLog = logger.infos.find((l) => l.msg.includes('completed'))
      expect(completionLog!.meta.totalSent).toBe(0)
      expect(completionLog!.meta.deliveryRate).toBe(0)
    })
  })

  describe('idempotency', () => {
    it('should produce same result when processing same data twice', async () => {
      const { processor, analyticsService, logger } = makeSut()
      const job = makeJob()

      await processor(job)
      await processor(job)

      expect(analyticsService.aggregateCalls).toHaveLength(2)
      const logs = logger.infos.filter((l) => l.msg.includes('completed'))
      expect(logs[0].meta.totalSent).toBe(logs[1].meta.totalSent)
    })
  })
})
