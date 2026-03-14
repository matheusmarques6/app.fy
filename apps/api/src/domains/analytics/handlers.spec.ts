import type { Dependencies } from '@appfy/core'
import type {
  AnalyticsOverview,
  AnalyticsPeriod,
  FlowAnalytics,
  NotificationAnalytics,
  RevenueDataPoint,
  TopNotification,
} from '@appfy/core'
import type { FlowType } from '@appfy/shared'
import { Hono } from 'hono'
import { describe, expect, it, beforeEach } from 'vitest'
import { createAnalyticsHandlers } from './handlers.js'

// ──────────────────────────────────────────────
// AnalyticsServiceSpy
// ──────────────────────────────────────────────

class AnalyticsServiceSpy {
  getOverviewCalls: Array<{ tenantId: string; period: AnalyticsPeriod }> = []
  overviewResult: AnalyticsOverview = {
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

  getByNotificationCalls: Array<{ tenantId: string; notificationId: string }> = []
  notificationResult: NotificationAnalytics = {
    notificationId: 'notif-1',
    sent: 50,
    delivered: 45,
    opened: 20,
    clicked: 5,
    converted: 1,
  }

  getByFlowCalls: Array<{ tenantId: string; flowType: FlowType; period: AnalyticsPeriod }> = []
  flowResult: FlowAnalytics = {
    flowType: 'cart_abandoned' as FlowType,
    totalNotifications: 10,
    totalSent: 100,
    totalConverted: 5,
    conversionRate: 0.05,
  }

  getRevenueChartCalls: Array<{ tenantId: string; period: AnalyticsPeriod }> = []
  revenueResult: RevenueDataPoint[] = [
    { date: '2026-01-01', converted: 3 },
    { date: '2026-01-02', converted: 5 },
  ]

  getTopNotificationsCalls: Array<{ tenantId: string; period: AnalyticsPeriod; limit?: number }> = []
  topResult: TopNotification[] = [
    { notificationId: 'n-1', title: 'Promo', converted: 10, sent: 100, conversionRate: 0.1 },
  ]

  async getOverview(tenantId: string, period: AnalyticsPeriod) {
    this.getOverviewCalls.push({ tenantId, period })
    return this.overviewResult
  }

  async getByNotification(tenantId: string, notificationId: string) {
    this.getByNotificationCalls.push({ tenantId, notificationId })
    return this.notificationResult
  }

  async getByFlow(tenantId: string, flowType: FlowType, period: AnalyticsPeriod) {
    this.getByFlowCalls.push({ tenantId, flowType, period })
    return this.flowResult
  }

  async getRevenueChart(tenantId: string, period: AnalyticsPeriod) {
    this.getRevenueChartCalls.push({ tenantId, period })
    return this.revenueResult
  }

  async getTopNotifications(tenantId: string, period: AnalyticsPeriod, limit?: number) {
    this.getTopNotificationsCalls.push({ tenantId, period, limit })
    return this.topResult
  }
}

// ──────────────────────────────────────────────
// Test helpers
// ──────────────────────────────────────────────

const TENANT_ID = 'tenant-analytics-test'

function makeSut() {
  const analyticsService = new AnalyticsServiceSpy()

  const deps = {
    analyticsService,
  } as unknown as Dependencies

  const handlers = createAnalyticsHandlers(deps)

  const app = new Hono()

  // Inject tenantId into context (simulates tenant middleware)
  app.use('/*', async (c, next) => {
    c.set('tenantId', TENANT_ID)
    await next()
  })

  app.get('/overview', handlers.overview)
  app.get('/notifications/:id', handlers.notificationMetrics)
  app.get('/flows', handlers.flowMetrics)
  app.get('/revenue', handlers.revenue)
  app.get('/top-notifications', handlers.topNotifications)

  return { app, analyticsService }
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('Analytics Handlers', () => {
  describe('GET /overview', () => {
    it('should return overview metrics with default 30d period', async () => {
      const { app, analyticsService } = makeSut()

      const res = await app.request('/overview')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.totalSent).toBe(100)
      expect(json.data.deliveryRate).toBe(0.9)
      expect(analyticsService.getOverviewCalls).toHaveLength(1)
      expect(analyticsService.getOverviewCalls[0].tenantId).toBe(TENANT_ID)
    })

    it('should accept period query param', async () => {
      const { app, analyticsService } = makeSut()

      await app.request('/overview?period=7d')

      const call = analyticsService.getOverviewCalls[0]
      const daysDiff = Math.round(
        (call.period.to.getTime() - call.period.from.getTime()) / (1000 * 60 * 60 * 24),
      )
      expect(daysDiff).toBe(7)
    })

    it('should return zeros when no data', async () => {
      const { app, analyticsService } = makeSut()
      analyticsService.overviewResult = {
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

      const res = await app.request('/overview')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.totalSent).toBe(0)
      expect(json.data.deliveryRate).toBe(0)
    })
  })

  describe('GET /notifications/:id', () => {
    it('should return per-notification metrics', async () => {
      const { app, analyticsService } = makeSut()

      const res = await app.request('/notifications/notif-1')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.notificationId).toBe('notif-1')
      expect(json.data.sent).toBe(50)
      expect(analyticsService.getByNotificationCalls[0].notificationId).toBe('notif-1')
    })
  })

  describe('GET /flows', () => {
    it('should return all flow types when no filter', async () => {
      const { app, analyticsService } = makeSut()

      const res = await app.request('/flows')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data).toHaveLength(9) // 9 flow types
      expect(analyticsService.getByFlowCalls).toHaveLength(9)
    })

    it('should filter by flow_type query param', async () => {
      const { app, analyticsService } = makeSut()

      const res = await app.request('/flows?flow_type=welcome')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data).toHaveLength(1)
      expect(analyticsService.getByFlowCalls).toHaveLength(1)
      expect(analyticsService.getByFlowCalls[0].flowType).toBe('welcome')
    })
  })

  describe('GET /revenue', () => {
    it('should return revenue chart data', async () => {
      const { app, analyticsService } = makeSut()

      const res = await app.request('/revenue')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data).toHaveLength(2)
      expect(json.data[0].date).toBe('2026-01-01')
      expect(json.data[0].converted).toBe(3)
      expect(analyticsService.getRevenueChartCalls).toHaveLength(1)
    })
  })

  describe('GET /top-notifications', () => {
    it('should return top notifications by conversion', async () => {
      const { app, analyticsService } = makeSut()

      const res = await app.request('/top-notifications')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data).toHaveLength(1)
      expect(json.data[0].title).toBe('Promo')
      expect(json.data[0].conversionRate).toBe(0.1)
      expect(analyticsService.getTopNotificationsCalls).toHaveLength(1)
    })
  })

  describe('tenant isolation', () => {
    it('should pass tenantId from context to all service calls', async () => {
      const { app, analyticsService } = makeSut()

      await app.request('/overview')
      await app.request('/notifications/n-1')
      await app.request('/revenue')
      await app.request('/top-notifications')

      expect(analyticsService.getOverviewCalls[0].tenantId).toBe(TENANT_ID)
      expect(analyticsService.getByNotificationCalls[0].tenantId).toBe(TENANT_ID)
      expect(analyticsService.getRevenueChartCalls[0].tenantId).toBe(TENANT_ID)
      expect(analyticsService.getTopNotificationsCalls[0].tenantId).toBe(TENANT_ID)
    })
  })
})
