import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QUEUE_NAMES } from '@appfy/shared';

interface MetricsJob {
  storeId: string;
  deviceId: string;
  eventName: string;
  valueAmountMinor?: number;
  currency?: string;
}

@Processor(QUEUE_NAMES.METRICS_UPDATE)
export class MetricsProcessor extends WorkerHost {
  private readonly logger = new Logger(MetricsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.SEGMENT_REFRESH)
    private readonly segmentQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<MetricsJob>): Promise<void> {
    const { storeId, deviceId, eventName, valueAmountMinor, currency } = job.data;

    this.logger.debug(`Updating metrics for device ${deviceId}`);

    try {
      // Get or create user metrics
      let metrics = await this.prisma.userMetrics.findUnique({
        where: { device_id: deviceId },
      });

      const now = new Date();

      if (!metrics) {
        metrics = await this.prisma.userMetrics.create({
          data: {
            device_id: deviceId,
            store_id: storeId,
            first_seen_at: now,
            last_seen_at: now,
            currency: currency || 'BRL',
          },
        });
      }

      // Build update object based on event
      const update: Record<string, any> = {
        last_seen_at: now,
      };

      // Increment counters based on event type
      switch (eventName) {
        case 'app_open':
          update.session_count_7d = { increment: 1 };
          update.session_count_30d = { increment: 1 };
          break;

        case 'view_product':
          update.view_product_7d = { increment: 1 };
          update.view_product_30d = { increment: 1 };
          break;

        case 'add_to_cart':
          update.add_to_cart_7d = { increment: 1 };
          update.add_to_cart_30d = { increment: 1 };
          break;

        case 'purchase_confirmed':
          update.purchases_7d = { increment: 1 };
          update.purchases_30d = { increment: 1 };
          update.purchases_90d = { increment: 1 };
          if (valueAmountMinor) {
            update.spent_7d_amount_minor = { increment: valueAmountMinor };
            update.spent_30d_amount_minor = { increment: valueAmountMinor };
            update.spent_90d_amount_minor = { increment: valueAmountMinor };
          }
          break;
      }

      // Update metrics
      await this.prisma.userMetrics.update({
        where: { device_id: deviceId },
        data: update,
      });

      // Queue segment refresh for this device
      await this.segmentQueue.add('refresh-device', {
        storeId,
        deviceId,
        changedFields: this.getChangedFields(eventName),
      });

      this.logger.debug(`Metrics updated for device ${deviceId}`);
    } catch (error) {
      this.logger.error(`Failed to update metrics for device ${deviceId}:`, error);
      throw error;
    }
  }

  private getChangedFields(eventName: string): string[] {
    const fieldMap: Record<string, string[]> = {
      app_open: ['session_count_7d', 'session_count_30d', 'last_seen_at'],
      view_product: ['view_product_7d', 'view_product_30d'],
      add_to_cart: ['add_to_cart_7d', 'add_to_cart_30d'],
      purchase_confirmed: [
        'purchases_7d',
        'purchases_30d',
        'purchases_90d',
        'spent_7d_amount_minor',
        'spent_30d_amount_minor',
        'spent_90d_amount_minor',
      ],
    };

    return fieldMap[eventName] || [];
  }
}
