import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@appfy/shared';

interface WebhookFilters {
  provider?: 'shopify' | 'woocommerce';
  topic?: string;
  status?: 'received' | 'processing' | 'processed' | 'failed';
  from?: Date;
  to?: Date;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.WEBHOOK_PROCESS) private readonly webhookQueue: Queue,
  ) {}

  /**
   * List webhook events with filters and pagination
   */
  async findAll(
    storeId: string,
    page: number = 1,
    limit: number = 50,
    filters?: WebhookFilters,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {
      store_id: storeId,
    };

    if (filters?.provider) {
      where.provider = filters.provider;
    }

    if (filters?.topic) {
      where.topic = { contains: filters.topic, mode: 'insensitive' };
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.from) {
      where.received_at = { ...where.received_at, gte: filters.from };
    }

    if (filters?.to) {
      where.received_at = { ...where.received_at, lte: filters.to };
    }

    const [events, total] = await Promise.all([
      this.prisma.webhookEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { received_at: 'desc' },
        select: {
          id: true,
          webhook_event_id: true,
          provider: true,
          topic: true,
          shop_domain: true,
          status: true,
          attempts: true,
          last_error: true,
          received_at: true,
          processed_at: true,
        },
      }),
      this.prisma.webhookEvent.count({ where }),
    ]);

    return {
      data: events,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single webhook event by ID
   */
  async findOne(storeId: string, eventId: string) {
    const event = await this.prisma.webhookEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Webhook event not found');
    }

    if (event.store_id !== storeId) {
      throw new NotFoundException('Webhook event not found');
    }

    return event;
  }

  /**
   * Retry a failed webhook event
   */
  async retry(storeId: string, eventId: string) {
    const event = await this.findOne(storeId, eventId);

    if (event.status !== 'failed') {
      return { success: false, message: 'Only failed events can be retried' };
    }

    // Update status to processing
    await this.prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: 'processing',
        attempts: { increment: 1 },
        last_error: null,
      },
    });

    // Add to processing queue
    await this.webhookQueue.add('process', {
      eventId,
      storeId,
      provider: event.provider,
      topic: event.topic,
      retry: true,
    });

    this.logger.log(`Retrying webhook event ${eventId}`);

    return { success: true, message: 'Event queued for retry' };
  }

  /**
   * Bulk retry failed events
   */
  async bulkRetry(storeId: string, eventIds: string[]) {
    const events = await this.prisma.webhookEvent.findMany({
      where: {
        id: { in: eventIds },
        store_id: storeId,
        status: 'failed',
      },
    });

    if (events.length === 0) {
      return { success: false, retried: 0, message: 'No failed events found' };
    }

    // Update all to processing
    await this.prisma.webhookEvent.updateMany({
      where: { id: { in: events.map((e) => e.id) } },
      data: {
        status: 'processing',
        last_error: null,
      },
    });

    // Queue all for processing
    const jobs = events.map((event) => ({
      name: 'process',
      data: {
        eventId: event.id,
        storeId,
        provider: event.provider,
        topic: event.topic,
        retry: true,
      },
    }));

    await this.webhookQueue.addBulk(jobs);

    this.logger.log(`Bulk retry: ${events.length} webhook events queued`);

    return { success: true, retried: events.length };
  }

  /**
   * Get webhook statistics
   */
  async getStats(storeId: string, from?: Date, to?: Date) {
    const dateFilter: any = {};
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;

    const where: any = { store_id: storeId };
    if (from || to) {
      where.received_at = dateFilter;
    }

    const [byStatus, byProvider, byTopic, recentFailed] = await Promise.all([
      // Count by status
      this.prisma.webhookEvent.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),

      // Count by provider
      this.prisma.webhookEvent.groupBy({
        by: ['provider'],
        where,
        _count: { _all: true },
      }),

      // Count by topic (top 10)
      this.prisma.webhookEvent.groupBy({
        by: ['topic'],
        where,
        _count: { _all: true },
        orderBy: { _count: { topic: 'desc' } },
        take: 10,
      }),

      // Recent failed events
      this.prisma.webhookEvent.findMany({
        where: {
          store_id: storeId,
          status: 'failed',
        },
        orderBy: { received_at: 'desc' },
        take: 5,
        select: {
          id: true,
          topic: true,
          provider: true,
          last_error: true,
          received_at: true,
          attempts: true,
        },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    let total = 0;
    for (const s of byStatus) {
      statusCounts[s.status] = s._count._all;
      total += s._count._all;
    }

    const providerCounts: Record<string, number> = {};
    for (const p of byProvider) {
      providerCounts[p.provider] = p._count._all;
    }

    return {
      total,
      by_status: statusCounts,
      by_provider: providerCounts,
      top_topics: byTopic.map((t) => ({
        topic: t.topic,
        count: t._count._all,
      })),
      success_rate:
        total > 0
          ? Math.round(((statusCounts['processed'] || 0) / total) * 100)
          : 0,
      recent_failures: recentFailed,
    };
  }

  /**
   * Delete old processed events (cleanup)
   */
  async cleanup(storeId: string, olderThanDays: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.webhookEvent.deleteMany({
      where: {
        store_id: storeId,
        status: 'processed',
        processed_at: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old webhook events for store ${storeId}`);

    return { deleted: result.count };
  }
}
