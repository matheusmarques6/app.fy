import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QUEUE_NAMES } from '@appfy/shared';

interface EventJob {
  storeId: string;
  deviceId: string;
  event: {
    event_id: string;
    name: string;
    ts: string;
    props?: Record<string, unknown>;
  };
  identityHint?: {
    external_customer_id?: string;
    email_hash?: string;
  };
}

@Processor(QUEUE_NAMES.EVENTS_INGEST)
export class EventsProcessor extends WorkerHost {
  private readonly logger = new Logger(EventsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.METRICS_UPDATE)
    private readonly metricsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AUTOMATION_EVAL)
    private readonly automationQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<EventJob>): Promise<void> {
    const { storeId, deviceId, event, identityHint } = job.data;

    this.logger.debug(`Processing event ${event.name} for device ${deviceId}`);

    try {
      // Extract hot columns from props
      const props = event.props || {};
      const productId = (props.product as any)?.id || props.product_id;
      const orderId = (props.order as any)?.order_id || props.order_id;
      const campaignId = (props.utm as any)?.campaign_id;
      const deliveryId = (props.utm as any)?.delivery_id;
      const valueAmountMinor =
        props.value_amount_minor ||
        (props.product as any)?.price_amount_minor ||
        (props.order as any)?.order_total_amount_minor;
      const currency =
        props.currency ||
        (props.product as any)?.currency ||
        (props.order as any)?.currency;

      // Store event
      await this.prisma.event.create({
        data: {
          store_id: storeId,
          device_id: deviceId,
          event_id: event.event_id,
          name: event.name,
          ts: new Date(event.ts),
          props: props as any,
          product_id: productId,
          order_id: orderId,
          campaign_id: campaignId,
          delivery_id: deliveryId,
          value_amount_minor: valueAmountMinor,
          currency,
        },
      });

      // Update device last_seen
      await this.prisma.device.update({
        where: { id: deviceId },
        data: { last_seen_at: new Date() },
      });

      // Handle identity hint (link customer if not confirmed yet)
      if (identityHint?.external_customer_id) {
        await this.handleIdentityHint(storeId, deviceId, identityHint);
      }

      // Queue metrics update
      await this.metricsQueue.add('update', {
        storeId,
        deviceId,
        eventName: event.name,
        valueAmountMinor,
        currency,
      });

      // Check for automation triggers
      await this.automationQueue.add('check-trigger', {
        storeId,
        deviceId,
        eventName: event.name,
        eventProps: props,
      });

      this.logger.debug(`Event ${event.event_id} processed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process event ${event.event_id}:`, error);
      throw error;
    }
  }

  private async handleIdentityHint(
    storeId: string,
    deviceId: string,
    identityHint: { external_customer_id?: string; email_hash?: string },
  ): Promise<void> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    // Only update if not already confirmed
    if (device && !device.identity_confirmed) {
      // Find or create customer
      let customer = await this.prisma.customer.findFirst({
        where: {
          store_id: storeId,
          external_customer_id: identityHint.external_customer_id,
        },
      });

      if (!customer && identityHint.external_customer_id) {
        customer = await this.prisma.customer.create({
          data: {
            store_id: storeId,
            external_customer_id: identityHint.external_customer_id,
            email_hash: identityHint.email_hash,
          },
        });
      }

      if (customer) {
        await this.prisma.device.update({
          where: { id: deviceId },
          data: {
            customer_id: customer.id,
            // Note: identity_confirmed stays false until webhook confirms
          },
        });
      }
    }
  }
}
