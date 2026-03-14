import type { FlowType } from '@appfy/shared'
import type {
  AnalyticsOverview,
  AnalyticsPeriod,
  AnalyticsRepository,
  FlowAnalytics,
  NotificationAnalytics,
  RevenueDataPoint,
  TopNotification,
} from './repository.js'

export class AnalyticsService {
  constructor(private readonly analyticsRepo: AnalyticsRepository) {}

  async getOverview(tenantId: string, period: AnalyticsPeriod): Promise<AnalyticsOverview> {
    return this.analyticsRepo.getOverview(tenantId, period)
  }

  async getByNotification(
    tenantId: string,
    notificationId: string,
  ): Promise<NotificationAnalytics> {
    return this.analyticsRepo.getByNotification(tenantId, notificationId)
  }

  async getByFlow(
    tenantId: string,
    flowType: FlowType,
    period: AnalyticsPeriod,
  ): Promise<FlowAnalytics> {
    return this.analyticsRepo.getByFlow(tenantId, flowType, period)
  }

  async getRevenueChart(tenantId: string, period: AnalyticsPeriod): Promise<RevenueDataPoint[]> {
    return this.analyticsRepo.getRevenueChart(tenantId, period)
  }

  async getTopNotifications(
    tenantId: string,
    period: AnalyticsPeriod,
    limit?: number,
  ): Promise<TopNotification[]> {
    return this.analyticsRepo.getTopNotifications(tenantId, period, limit)
  }

  async aggregate(tenantId: string, period: AnalyticsPeriod): Promise<AnalyticsOverview> {
    return this.analyticsRepo.getOverview(tenantId, period)
  }
}
