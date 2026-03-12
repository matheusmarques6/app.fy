import type { FlowType } from '@appfy/shared'
import { BaseRepository } from '../repositories/base.repository.js'

export interface AnalyticsOverview {
  readonly totalSent: number
  readonly totalDelivered: number
  readonly totalOpened: number
  readonly totalClicked: number
  readonly totalConverted: number
  readonly deliveryRate: number
  readonly openRate: number
  readonly clickRate: number
  readonly conversionRate: number
}

export interface NotificationAnalytics {
  readonly notificationId: string
  readonly sent: number
  readonly delivered: number
  readonly opened: number
  readonly clicked: number
  readonly converted: number
}

export interface FlowAnalytics {
  readonly flowType: FlowType
  readonly totalNotifications: number
  readonly totalSent: number
  readonly totalConverted: number
  readonly conversionRate: number
}

export interface AnalyticsPeriod {
  readonly from: Date
  readonly to: Date
}

export class AnalyticsRepository extends BaseRepository {
  async getOverview(tenantId: string, _period: AnalyticsPeriod): Promise<AnalyticsOverview> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async getByNotification(
    tenantId: string,
    _notificationId: string,
  ): Promise<NotificationAnalytics> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async getByFlow(
    tenantId: string,
    _flowType: FlowType,
    _period: AnalyticsPeriod,
  ): Promise<FlowAnalytics> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }
}
