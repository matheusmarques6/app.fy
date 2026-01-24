import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface DateRange {
  from: Date;
  to: Date;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  revenue?: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Overview dashboard stats
   */
  async getOverview(storeId: string, range: DateRange) {
    const [
      totalDevices,
      newDevices,
      activeDevices,
      pushSubscribers,
      totalOrders,
      totalRevenue,
      totalEvents,
      totalCampaignsSent,
    ] = await Promise.all([
      // Total devices
      this.prisma.device.count({ where: { store_id: storeId } }),

      // New devices in range
      this.prisma.device.count({
        where: {
          store_id: storeId,
          created_at: { gte: range.from, lte: range.to },
        },
      }),

      // Active devices (seen in range)
      this.prisma.device.count({
        where: {
          store_id: storeId,
          last_seen_at: { gte: range.from, lte: range.to },
        },
      }),

      // Push subscribers
      this.prisma.device.count({
        where: {
          store_id: storeId,
          push_subscriptions: { some: { opt_in: true } },
        },
      }),

      // Orders in range
      this.prisma.order.count({
        where: {
          store_id: storeId,
          created_at: { gte: range.from, lte: range.to },
        },
      }),

      // Total revenue in range
      this.prisma.order.aggregate({
        where: {
          store_id: storeId,
          status: { in: ['created', 'paid'] },
          created_at: { gte: range.from, lte: range.to },
        },
        _sum: { total_amount_minor: true },
      }),

      // Events in range
      this.prisma.event.count({
        where: {
          store_id: storeId,
          ts: { gte: range.from, lte: range.to },
        },
      }),

      // Campaigns sent in range
      this.prisma.campaign.count({
        where: {
          store_id: storeId,
          status: 'sent',
          sent_at: { gte: range.from, lte: range.to },
        },
      }),
    ]);

    return {
      devices: {
        total: totalDevices,
        new: newDevices,
        active: activeDevices,
        push_subscribers: pushSubscribers,
        push_rate: totalDevices > 0 ? Math.round((pushSubscribers / totalDevices) * 100) : 0,
      },
      orders: {
        total: totalOrders,
        revenue_minor: totalRevenue._sum.total_amount_minor || 0,
      },
      engagement: {
        events: totalEvents,
        campaigns_sent: totalCampaignsSent,
      },
    };
  }

  /**
   * Push notification performance
   */
  async getPushStats(storeId: string, range: DateRange) {
    const deliveries = await this.prisma.delivery.groupBy({
      by: ['status'],
      where: {
        store_id: storeId,
        created_at: { gte: range.from, lte: range.to },
      },
      _count: true,
    });

    const statusCounts: Record<string, number> = {};
    let total = 0;
    for (const d of deliveries) {
      statusCounts[d.status] = d._count;
      total += d._count;
    }

    const sent = statusCounts['sent'] || 0;
    const delivered = statusCounts['delivered'] || 0;
    const opened = statusCounts['opened'] || 0;
    const clicked = statusCounts['clicked'] || 0;
    const failed = statusCounts['failed'] || 0;

    return {
      total,
      sent,
      delivered,
      opened,
      clicked,
      failed,
      rates: {
        delivery: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
        open: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
        click: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
      },
    };
  }

  /**
   * Campaign performance list
   */
  async getCampaignStats(storeId: string, range: DateRange, limit: number = 10) {
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        store_id: storeId,
        sent_at: { gte: range.from, lte: range.to },
      },
      orderBy: { sent_at: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        status: true,
        sent_at: true,
        stats: true,
        _count: {
          select: { deliveries: true },
        },
      },
    });

    // Get delivery stats for each campaign
    const campaignIds = campaigns.map((c) => c.id);
    const deliveryStats = await this.prisma.delivery.groupBy({
      by: ['campaign_id', 'status'],
      where: {
        campaign_id: { in: campaignIds },
      },
      _count: true,
    });

    // Build stats map
    const statsMap: Record<string, Record<string, number>> = {};
    for (const d of deliveryStats) {
      if (!d.campaign_id) continue;
      if (!statsMap[d.campaign_id]) {
        statsMap[d.campaign_id] = {};
      }
      statsMap[d.campaign_id][d.status] = d._count;
    }

    return campaigns.map((c) => {
      const stats = statsMap[c.id] || {};
      const sent = stats['sent'] || 0;
      const delivered = stats['delivered'] || 0;
      const opened = stats['opened'] || 0;
      const clicked = stats['clicked'] || 0;

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        sent_at: c.sent_at,
        total_deliveries: c._count.deliveries,
        sent,
        delivered,
        opened,
        clicked,
        open_rate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
        click_rate: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
      };
    });
  }

  /**
   * Events breakdown by type
   */
  async getEventStats(storeId: string, range: DateRange, limit: number = 20) {
    const events = await this.prisma.event.groupBy({
      by: ['name'],
      where: {
        store_id: storeId,
        ts: { gte: range.from, lte: range.to },
      },
      _count: true,
      orderBy: { _count: { name: 'desc' } },
      take: limit,
    });

    const total = events.reduce((sum, e) => sum + e._count, 0);

    return {
      total,
      by_type: events.map((e) => ({
        name: e.name,
        count: e._count,
        percentage: total > 0 ? Math.round((e._count / total) * 100) : 0,
      })),
    };
  }

  /**
   * Revenue attribution (orders linked to campaigns/automations)
   */
  async getRevenueAttribution(storeId: string, range: DateRange) {
    const attributions = await this.prisma.attribution.findMany({
      where: {
        store_id: storeId,
        created_at: { gte: range.from, lte: range.to },
      },
      include: {
        order: {
          select: {
            total_amount_minor: true,
            currency: true,
          },
        },
      },
    });

    let totalAttributed = 0;
    const byModel: Record<string, { count: number; revenue: number }> = {};

    for (const attr of attributions) {
      const revenue = attr.order.total_amount_minor;
      totalAttributed += revenue;

      if (!byModel[attr.model]) {
        byModel[attr.model] = { count: 0, revenue: 0 };
      }
      byModel[attr.model].count++;
      byModel[attr.model].revenue += revenue;
    }

    // Get total revenue for comparison
    const totalRevenue = await this.prisma.order.aggregate({
      where: {
        store_id: storeId,
        status: { in: ['created', 'paid'] },
        created_at: { gte: range.from, lte: range.to },
      },
      _sum: { total_amount_minor: true },
    });

    const total = totalRevenue._sum.total_amount_minor || 0;

    return {
      total_revenue_minor: total,
      attributed_revenue_minor: totalAttributed,
      attribution_rate: total > 0 ? Math.round((totalAttributed / total) * 100) : 0,
      by_model: Object.entries(byModel).map(([model, stats]) => ({
        model,
        orders: stats.count,
        revenue_minor: stats.revenue,
      })),
    };
  }

  /**
   * Time series: new devices per day
   */
  async getDevicesTimeSeries(storeId: string, range: DateRange): Promise<TimeSeriesPoint[]> {
    const devices = await this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM devices
      WHERE store_id = ${storeId}::uuid
        AND created_at >= ${range.from}
        AND created_at <= ${range.to}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return devices.map((d) => ({
      date: d.date.toISOString().split('T')[0],
      value: Number(d.count),
    }));
  }

  /**
   * Time series: orders per day
   */
  async getOrdersTimeSeries(storeId: string, range: DateRange): Promise<TimeSeriesPoint[]> {
    const orders = await this.prisma.$queryRaw<{ date: Date; count: bigint; revenue: bigint }[]>`
      SELECT DATE(created_at) as date, COUNT(*) as count, COALESCE(SUM(total_amount_minor), 0) as revenue
      FROM orders
      WHERE store_id = ${storeId}::uuid
        AND created_at >= ${range.from}
        AND created_at <= ${range.to}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return orders.map((o) => ({
      date: o.date.toISOString().split('T')[0],
      value: Number(o.count),
      revenue: Number(o.revenue),
    }));
  }

  /**
   * Time series: events per day
   */
  async getEventsTimeSeries(storeId: string, range: DateRange): Promise<TimeSeriesPoint[]> {
    const events = await this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT DATE(ts) as date, COUNT(*) as count
      FROM events
      WHERE store_id = ${storeId}::uuid
        AND ts >= ${range.from}
        AND ts <= ${range.to}
      GROUP BY DATE(ts)
      ORDER BY date ASC
    `;

    return events.map((e) => ({
      date: e.date.toISOString().split('T')[0],
      value: Number(e.count),
    }));
  }

  /**
   * Automation performance
   */
  async getAutomationStats(storeId: string, range: DateRange) {
    const automations = await this.prisma.automation.findMany({
      where: {
        store_id: storeId,
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        entry_event: true,
        stats: true,
        _count: {
          select: {
            runs: true,
            deliveries: true,
          },
        },
      },
    });

    // Get run stats for each automation
    const automationIds = automations.map((a) => a.id);
    const runStats = await this.prisma.automationRun.groupBy({
      by: ['automation_id', 'status'],
      where: {
        automation_id: { in: automationIds },
        started_at: { gte: range.from, lte: range.to },
      },
      _count: { _all: true },
    });

    const statsMap: Record<string, Record<string, number>> = {};
    for (const r of runStats) {
      if (!statsMap[r.automation_id]) {
        statsMap[r.automation_id] = {};
      }
      statsMap[r.automation_id][r.status] = r._count._all;
    }

    return automations.map((a) => {
      const stats = statsMap[a.id] || {};
      return {
        id: a.id,
        name: a.name,
        entry_event: a.entry_event,
        total_runs: a._count.runs,
        total_deliveries: a._count.deliveries,
        runs_in_period: {
          running: stats['running'] || 0,
          completed: stats['completed'] || 0,
          exited: stats['exited'] || 0,
        },
      };
    });
  }
}
