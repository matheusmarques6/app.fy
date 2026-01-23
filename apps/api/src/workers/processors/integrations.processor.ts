import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ShopifyService } from '../../modules/integrations/services/shopify.service';
import { WooCommerceService } from '../../modules/integrations/services/woocommerce.service';
import { QUEUE_NAMES } from '@appfy/shared';

interface ShopifyWebhookJob {
  webhookEventId: string;
  integrationId: string;
  topic: string;
  shopDomain: string;
  payload: any;
}

interface WooCommerceWebhookJob {
  webhookEventId: string;
  integrationId: string;
  topic: string;
  payload: any;
}

type IntegrationJob = ShopifyWebhookJob | WooCommerceWebhookJob;

@Processor(QUEUE_NAMES.INTEGRATIONS_SYNC)
export class IntegrationsProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shopifyService: ShopifyService,
    private readonly wooCommerceService: WooCommerceService,
  ) {
    super();
  }

  async process(job: Job<IntegrationJob>): Promise<void> {
    const jobName = job.name;

    switch (jobName) {
      case 'shopify-webhook':
        await this.processShopifyWebhook(job as Job<ShopifyWebhookJob>);
        break;
      case 'woocommerce-webhook':
        await this.processWooCommerceWebhook(job as Job<WooCommerceWebhookJob>);
        break;
      default:
        this.logger.warn(`Unknown job type: ${jobName}`);
    }
  }

  private async processShopifyWebhook(job: Job<ShopifyWebhookJob>): Promise<void> {
    const { webhookEventId, integrationId, topic, shopDomain, payload } = job.data;

    this.logger.log(`Processing Shopify webhook ${webhookEventId} (${topic})`);

    // Update status to processing
    await this.prisma.webhookEvent.update({
      where: { webhook_event_id: webhookEventId },
      data: {
        status: 'processing',
        attempts: { increment: 1 },
      },
    });

    try {
      // Process the webhook
      await this.shopifyService.processWebhook(integrationId, topic, shopDomain, payload);

      // Update status to processed
      await this.prisma.webhookEvent.update({
        where: { webhook_event_id: webhookEventId },
        data: {
          status: 'processed',
          processed_at: new Date(),
        },
      });

      this.logger.log(`Successfully processed Shopify webhook ${webhookEventId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update status to failed
      await this.prisma.webhookEvent.update({
        where: { webhook_event_id: webhookEventId },
        data: {
          status: 'failed',
          last_error: errorMessage,
        },
      });

      this.logger.error(`Failed to process Shopify webhook ${webhookEventId}: ${errorMessage}`);
      throw error; // Re-throw for BullMQ retry handling
    }
  }

  private async processWooCommerceWebhook(job: Job<WooCommerceWebhookJob>): Promise<void> {
    const { webhookEventId, integrationId, topic, payload } = job.data;

    this.logger.log(`Processing WooCommerce webhook ${webhookEventId} (${topic})`);

    // Update status to processing
    await this.prisma.webhookEvent.update({
      where: { webhook_event_id: webhookEventId },
      data: {
        status: 'processing',
        attempts: { increment: 1 },
      },
    });

    try {
      // Process the webhook
      await this.wooCommerceService.processWebhook(integrationId, topic, payload);

      // Update status to processed
      await this.prisma.webhookEvent.update({
        where: { webhook_event_id: webhookEventId },
        data: {
          status: 'processed',
          processed_at: new Date(),
        },
      });

      this.logger.log(`Successfully processed WooCommerce webhook ${webhookEventId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update status to failed
      await this.prisma.webhookEvent.update({
        where: { webhook_event_id: webhookEventId },
        data: {
          status: 'failed',
          last_error: errorMessage,
        },
      });

      this.logger.error(`Failed to process WooCommerce webhook ${webhookEventId}: ${errorMessage}`);
      throw error;
    }
  }
}
