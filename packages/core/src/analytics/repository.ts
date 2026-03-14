import { notificationDeliveries, notifications } from '@appfy/db'
import type { FlowType } from '@appfy/shared'
import { and, count, eq, gte, lte, sql } from 'drizzle-orm'
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
  async getOverview(tenantId: string, period: AnalyticsPeriod): Promise<AnalyticsOverview> {
    this.assertTenantId(tenantId)

    const result = await this.db
      .select({
        totalSent: sql<number>`count(*) filter (where ${notificationDeliveries.status} in ('sent','delivered','opened','clicked','converted'))`,
        totalDelivered: sql<number>`count(*) filter (where ${notificationDeliveries.status} in ('delivered','opened','clicked','converted'))`,
        totalOpened: sql<number>`count(*) filter (where ${notificationDeliveries.status} in ('opened','clicked','converted'))`,
        totalClicked: sql<number>`count(*) filter (where ${notificationDeliveries.status} in ('clicked','converted'))`,
        totalConverted: sql<number>`count(*) filter (where ${notificationDeliveries.status} = 'converted')`,
      })
      .from(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.tenantId, tenantId),
          gte(notificationDeliveries.createdAt, period.from),
          lte(notificationDeliveries.createdAt, period.to),
        ),
      )

    const row = result[0]
    const totalSent = Number(row?.totalSent ?? 0)
    const totalDelivered = Number(row?.totalDelivered ?? 0)
    const totalOpened = Number(row?.totalOpened ?? 0)
    const totalClicked = Number(row?.totalClicked ?? 0)
    const totalConverted = Number(row?.totalConverted ?? 0)

    return {
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalConverted,
      deliveryRate: totalSent > 0 ? totalDelivered / totalSent : 0,
      openRate: totalDelivered > 0 ? totalOpened / totalDelivered : 0,
      clickRate: totalOpened > 0 ? totalClicked / totalOpened : 0,
      conversionRate: totalClicked > 0 ? totalConverted / totalClicked : 0,
    }
  }

  async getByNotification(
    tenantId: string,
    notificationId: string,
  ): Promise<NotificationAnalytics> {
    this.assertTenantId(tenantId)

    const result = await this.db
      .select({
        sent: sql<number>`count(*) filter (where ${notificationDeliveries.status} in ('sent','delivered','opened','clicked','converted'))`,
        delivered: sql<number>`count(*) filter (where ${notificationDeliveries.status} in ('delivered','opened','clicked','converted'))`,
        opened: sql<number>`count(*) filter (where ${notificationDeliveries.status} in ('opened','clicked','converted'))`,
        clicked: sql<number>`count(*) filter (where ${notificationDeliveries.status} in ('clicked','converted'))`,
        converted: sql<number>`count(*) filter (where ${notificationDeliveries.status} = 'converted')`,
      })
      .from(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.tenantId, tenantId),
          eq(notificationDeliveries.notificationId, notificationId),
        ),
      )

    const row = result[0]
    return {
      notificationId,
      sent: Number(row?.sent ?? 0),
      delivered: Number(row?.delivered ?? 0),
      opened: Number(row?.opened ?? 0),
      clicked: Number(row?.clicked ?? 0),
      converted: Number(row?.converted ?? 0),
    }
  }

  async getByFlow(
    tenantId: string,
    flowType: FlowType,
    period: AnalyticsPeriod,
  ): Promise<FlowAnalytics> {
    this.assertTenantId(tenantId)

    const [notifCount] = await this.db
      .select({ total: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, tenantId),
          eq(notifications.flowType, flowType),
          gte(notifications.createdAt, period.from),
          lte(notifications.createdAt, period.to),
        ),
      )

    const deliveryResult = await this.db
      .select({
        totalSent: sql<number>`count(*) filter (where ${notificationDeliveries.status} in ('sent','delivered','opened','clicked','converted'))`,
        totalConverted: sql<number>`count(*) filter (where ${notificationDeliveries.status} = 'converted')`,
      })
      .from(notificationDeliveries)
      .innerJoin(notifications, eq(notificationDeliveries.notificationId, notifications.id))
      .where(
        and(
          eq(notificationDeliveries.tenantId, tenantId),
          eq(notifications.flowType, flowType),
          gte(notificationDeliveries.createdAt, period.from),
          lte(notificationDeliveries.createdAt, period.to),
        ),
      )

    const totalSent = Number(deliveryResult[0]?.totalSent ?? 0)
    const totalConverted = Number(deliveryResult[0]?.totalConverted ?? 0)

    return {
      flowType,
      totalNotifications: Number(notifCount?.total ?? 0),
      totalSent,
      totalConverted,
      conversionRate: totalSent > 0 ? totalConverted / totalSent : 0,
    }
  }
}
