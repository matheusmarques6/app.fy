import type { Dependencies } from '@appfy/core'
import type { AnalyticsPeriod } from '@appfy/core'
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

    /** GET /analytics/flows — Per-flow metrics */
    async flowMetrics(c: Context) {
      // TODO: Accept flowType as query param and call analyticsService.getByFlow
      // For now return empty array until flowType param is defined
      return c.json({ data: [] })
    },
  }
}
