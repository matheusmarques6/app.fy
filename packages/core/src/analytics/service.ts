import type { FlowType } from '@appfy/shared'
import type {
  AnalyticsOverview,
  AnalyticsPeriod,
  AnalyticsRepository,
  FlowAnalytics,
  NotificationAnalytics,
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
}
