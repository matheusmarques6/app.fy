import { describe, expect, it } from 'vitest'
import type { FlowType } from '@appfy/shared'
import { AnalyticsService } from './service.js'
import type {
  AnalyticsOverview,
  AnalyticsPeriod,
  FlowAnalytics,
  NotificationAnalytics,
  RevenueDataPoint,
  TopNotification,
} from './repository.js'

class AnalyticsRepositorySpy {
  getOverviewCallCount = 0
  getOverviewCalledWith: Array<{ tenantId: string; period: AnalyticsPeriod }> = []
  overviewResult: AnalyticsOverview = {
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

  getByNotificationCallCount = 0
  getByNotificationCalledWith: Array<{ tenantId: string; notificationId: string }> = []
  notificationResult: NotificationAnalytics = {
    notificationId: '',
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    converted: 0,
  }

  getByFlowCallCount = 0
  getByFlowCalledWith: Array<{ tenantId: string; flowType: FlowType; period: AnalyticsPeriod }> = []
  flowResult: FlowAnalytics = {
    flowType: 'cart_abandoned' as FlowType,
    totalNotifications: 0,
    totalSent: 0,
    totalConverted: 0,
    conversionRate: 0,
  }

  getRevenueChartCallCount = 0
  getRevenueChartCalledWith: Array<{ tenantId: string; period: AnalyticsPeriod }> = []
  revenueResult: RevenueDataPoint[] = []

  getTopNotificationsCallCount = 0
  getTopNotificationsCalledWith: Array<{ tenantId: string; period: AnalyticsPeriod; limit?: number }> = []
  topNotificationsResult: TopNotification[] = []

  async getOverview(tenantId: string, period: AnalyticsPeriod) {
    this.getOverviewCallCount++
    this.getOverviewCalledWith.push({ tenantId, period })
    return this.overviewResult
  }

  async getByNotification(tenantId: string, notificationId: string) {
    this.getByNotificationCallCount++
    this.getByNotificationCalledWith.push({ tenantId, notificationId })
    return this.notificationResult
  }

  async getByFlow(tenantId: string, flowType: FlowType, period: AnalyticsPeriod) {
    this.getByFlowCallCount++
    this.getByFlowCalledWith.push({ tenantId, flowType, period })
    return this.flowResult
  }

  async getRevenueChart(tenantId: string, period: AnalyticsPeriod) {
    this.getRevenueChartCallCount++
    this.getRevenueChartCalledWith.push({ tenantId, period })
    return this.revenueResult
  }

  async getTopNotifications(tenantId: string, period: AnalyticsPeriod, limit?: number) {
    this.getTopNotificationsCallCount++
    this.getTopNotificationsCalledWith.push({ tenantId, period, limit })
    return this.topNotificationsResult
  }
}

function makeSut() {
  const repo = new AnalyticsRepositorySpy()
  const sut = new AnalyticsService(repo as unknown as import('./repository.js').AnalyticsRepository)
  return { sut, repo }
}

describe('AnalyticsService', () => {
  const tenantId = 'tenant-1'
  const period: AnalyticsPeriod = { from: new Date('2026-01-01'), to: new Date('2026-01-31') }

  describe('getOverview', () => {
    it('should delegate to repository', async () => {
      const { sut, repo } = makeSut()
      repo.overviewResult = {
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

      const result = await sut.getOverview(tenantId, period)

      expect(repo.getOverviewCallCount).toBe(1)
      expect(repo.getOverviewCalledWith[0]).toEqual({ tenantId, period })
      expect(result.totalSent).toBe(100)
    })
  })

  describe('getByNotification', () => {
    it('should delegate to repository', async () => {
      const { sut, repo } = makeSut()
      const notificationId = 'notif-1'
      repo.notificationResult = {
        notificationId,
        sent: 50,
        delivered: 45,
        opened: 20,
        clicked: 5,
        converted: 1,
      }

      const result = await sut.getByNotification(tenantId, notificationId)

      expect(repo.getByNotificationCallCount).toBe(1)
      expect(result.notificationId).toBe(notificationId)
      expect(result.sent).toBe(50)
    })
  })

  describe('getByFlow', () => {
    it('should delegate to repository', async () => {
      const { sut, repo } = makeSut()
      const flowType: FlowType = 'welcome'
      repo.flowResult = {
        flowType,
        totalNotifications: 10,
        totalSent: 100,
        totalConverted: 5,
        conversionRate: 0.05,
      }

      const result = await sut.getByFlow(tenantId, flowType, period)

      expect(repo.getByFlowCallCount).toBe(1)
      expect(repo.getByFlowCalledWith[0]).toEqual({ tenantId, flowType, period })
      expect(result.flowType).toBe('welcome')
    })
  })

  describe('getRevenueChart', () => {
    it('should delegate to repository', async () => {
      const { sut, repo } = makeSut()
      repo.revenueResult = [
        { date: '2026-01-01', converted: 3 },
        { date: '2026-01-02', converted: 5 },
      ]

      const result = await sut.getRevenueChart(tenantId, period)

      expect(repo.getRevenueChartCallCount).toBe(1)
      expect(result).toHaveLength(2)
      expect(result[0]!.date).toBe('2026-01-01')
    })
  })

  describe('getTopNotifications', () => {
    it('should delegate to repository with default limit', async () => {
      const { sut, repo } = makeSut()
      repo.topNotificationsResult = [
        { notificationId: 'n-1', title: 'Promo', converted: 10, sent: 100, conversionRate: 0.1 },
      ]

      const result = await sut.getTopNotifications(tenantId, period)

      expect(repo.getTopNotificationsCallCount).toBe(1)
      expect(result).toHaveLength(1)
      expect(result[0]!.title).toBe('Promo')
    })

    it('should pass custom limit to repository', async () => {
      const { sut, repo } = makeSut()

      await sut.getTopNotifications(tenantId, period, 10)

      expect(repo.getTopNotificationsCalledWith[0]!.limit).toBe(10)
    })
  })

  describe('aggregate', () => {
    it('should delegate to getOverview', async () => {
      const { sut, repo } = makeSut()
      repo.overviewResult = {
        totalSent: 50,
        totalDelivered: 40,
        totalOpened: 20,
        totalClicked: 5,
        totalConverted: 1,
        deliveryRate: 0.8,
        openRate: 0.5,
        clickRate: 0.25,
        conversionRate: 0.2,
      }

      const result = await sut.aggregate(tenantId, period)

      expect(repo.getOverviewCallCount).toBe(1)
      expect(result.totalSent).toBe(50)
    })
  })
})
