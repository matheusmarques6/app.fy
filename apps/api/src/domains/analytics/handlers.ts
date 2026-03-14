import type { Dependencies } from '@appfy/core'
import type { AnalyticsPeriod } from '@appfy/core'
import type { FlowType } from '@appfy/shared'
import { flowTypes } from '@appfy/shared'
import type { Context } from 'hono'

/** Maps period query string to AnalyticsPeriod date range */
function parsePeriod(periodStr: string): AnalyticsPeriod {
  const to = new Date()
  const from = new Date()
  const days = periodStr === '7d' ? 7 : periodStr === '90d' ? 90 : 30
  from.setDate(from.getDate() - days)
  return { from, to }
}

export function createAnalyticsHandlers(deps: Dependencies) {
  return {
    /** GET /analytics/overview — Dashboard metrics */
    async overview(c: Context) {
      const tenantId = c.get('tenantId') as string
      const periodStr = c.req.query('period') ?? '30d'
      const period = parsePeriod(periodStr)
      const overview = await deps.analyticsService.getOverview(tenantId, period)
      return c.json({ data: overview })
    },

    /** GET /analytics/notifications/:id — Per-notification metrics */
    async notificationMetrics(c: Context) {
      const tenantId = c.get('tenantId') as string
      const id = c.req.param('id')!
      const metrics = await deps.analyticsService.getByNotification(tenantId, id)
      return c.json({ data: metrics })
    },

    /** GET /analytics/flows — Per-flow metrics (optional ?flow_type= filter) */
    async flowMetrics(c: Context) {
      const tenantId = c.get('tenantId') as string
      const periodStr = c.req.query('period') ?? '30d'
      const period = parsePeriod(periodStr)
      const flowTypeParam = c.req.query('flow_type')

      if (flowTypeParam && flowTypes.includes(flowTypeParam as FlowType)) {
        const metrics = await deps.analyticsService.getByFlow(
          tenantId,
          flowTypeParam as FlowType,
          period,
        )
        return c.json({ data: [metrics] })
      }

      const results = await Promise.all(
        flowTypes.map((ft) => deps.analyticsService.getByFlow(tenantId, ft, period)),
      )
      return c.json({ data: results })
    },

    /** GET /analytics/revenue — Revenue chart data (converted deliveries per day) */
    async revenue(c: Context) {
      const tenantId = c.get('tenantId') as string
      const periodStr = c.req.query('period') ?? '30d'
      const period = parsePeriod(periodStr)
      const chart = await deps.analyticsService.getRevenueChart(tenantId, period)
      return c.json({ data: chart })
    },

    /** GET /analytics/top-notifications — Top 5 notifications by conversion */
    async topNotifications(c: Context) {
      const tenantId = c.get('tenantId') as string
      const periodStr = c.req.query('period') ?? '30d'
      const period = parsePeriod(periodStr)
      const top = await deps.analyticsService.getTopNotifications(tenantId, period)
      return c.json({ data: top })
    },
  }
}
