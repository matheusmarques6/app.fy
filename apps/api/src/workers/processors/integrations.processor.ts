import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ShopifyService } from '../../modules/integrations/services/shopify.service';
import { WooCommerceService } from '../../modules/integrations/services/woocommerce.service';
import { QUEUE_NAMES, ATTRIBUTION_WINDOW_HOURS } from '@appfy/shared';

interface ShopifyWebhookJob {
  webhookEventId: string;
  storeId: string;
  integrationId: string;
  topic: string;
  shopDomain: string;
  payload: any;
}

interface WooCommerceWebhookJob {
  webhookEventId: string;
  storeId: string;
  integrationId: string;
  topic: string;
  payload: any;
}

interface CatalogSyncJob {
  storeId: string;
  integrationId: string;
  platform: 'shopify' | 'woocommerce';
  syncType: 'full' | 'incremental';
}

interface AttributionCalculationJob {
  storeId: string;
  orderId: string;
  platform: 'shopify' | 'woocommerce';
}

type IntegrationJob =
  | ShopifyWebhookJob
  | WooCommerceWebhookJob
  | CatalogSyncJob
  | AttributionCalculationJob;

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
      case 'catalog-sync':
        await this.processCatalogSync(job as Job<CatalogSyncJob>);
        break;
      case 'attribution-calculation':
        await this.processAttributionCalculation(job as Job<AttributionCalculationJob>);
        break;
      default:
        this.logger.warn(`Unknown job type: ${jobName}`);
    }
  }

  // Max retry attempts before giving up
  private readonly MAX_ATTEMPTS = 3;

  /**
   * Acquire processing lock using atomic status update
   * Returns true if lock acquired, false if already processing/processed
   */
  private async acquireProcessingLock(
    storeId: string,
    provider: string,
    webhookEventId: string,
  ): Promise<boolean> {
    const result = await this.prisma.webhookEvent.updateMany({
      where: {
        store_id: storeId,
        provider,
        webhook_event_id: webhookEventId,
        status: { in: ['received', 'failed'] },
        attempts: { lt: this.MAX_ATTEMPTS },
      },
      data: {
        status: 'processing',
        attempts: { increment: 1 },
      },
    });

    return result.count > 0;
  }

  private async processShopifyWebhook(job: Job<ShopifyWebhookJob>): Promise<void> {
    const { webhookEventId, storeId, integrationId, topic, shopDomain, payload } = job.data;

    this.logger.log(`Processing Shopify webhook ${webhookEventId} (${topic})`);

    const lockAcquired = await this.acquireProcessingLock(storeId, 'shopify', webhookEventId);
    if (!lockAcquired) {
      this.logger.log(`Webhook ${webhookEventId} already processing or processed - skipping`);
      return;
    }

    try {
      await this.shopifyService.processWebhook(integrationId, topic, shopDomain, payload);

      await this.prisma.webhookEvent.updateMany({
        where: {
          store_id: storeId,
          provider: 'shopify',
          webhook_event_id: webhookEventId,
        },
        data: {
          status: 'processed',
          processed_at: new Date(),
        },
      });

      this.logger.log(`Successfully processed Shopify webhook ${webhookEventId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.prisma.webhookEvent.updateMany({
        where: {
          store_id: storeId,
          provider: 'shopify',
          webhook_event_id: webhookEventId,
        },
        data: {
          status: 'failed',
          last_error: errorMessage,
        },
      });

      this.logger.error(`Failed to process Shopify webhook ${webhookEventId}: ${errorMessage}`);
      throw error;
    }
  }

  private async processWooCommerceWebhook(job: Job<WooCommerceWebhookJob>): Promise<void> {
    const { webhookEventId, storeId, integrationId, topic, payload } = job.data;

    this.logger.log(`Processing WooCommerce webhook ${webhookEventId} (${topic})`);

    const lockAcquired = await this.acquireProcessingLock(storeId, 'woocommerce', webhookEventId);
    if (!lockAcquired) {
      this.logger.log(`Webhook ${webhookEventId} already processing or processed - skipping`);
      return;
    }

    try {
      await this.wooCommerceService.processWebhook(integrationId, topic, payload);

      await this.prisma.webhookEvent.updateMany({
        where: {
          store_id: storeId,
          provider: 'woocommerce',
          webhook_event_id: webhookEventId,
        },
        data: {
          status: 'processed',
          processed_at: new Date(),
        },
      });

      this.logger.log(`Successfully processed WooCommerce webhook ${webhookEventId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.prisma.webhookEvent.updateMany({
        where: {
          store_id: storeId,
          provider: 'woocommerce',
          webhook_event_id: webhookEventId,
        },
        data: {
          status: 'failed',
          last_error: errorMessage,
        },
      });

      this.logger.error(`Failed to process WooCommerce webhook ${webhookEventId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Process catalog sync job - syncs products/orders from the platform
   */
  private async processCatalogSync(job: Job<CatalogSyncJob>): Promise<void> {
    const { integrationId, platform, syncType } = job.data;

    this.logger.log(`Starting ${syncType} catalog sync for ${platform} integration ${integrationId}`);

    try {
      // Platform-specific sync logic
      if (platform === 'shopify') {
        await this.syncShopifyCatalog(integrationId, syncType);
      } else if (platform === 'woocommerce') {
        await this.syncWooCommerceCatalog(integrationId, syncType);
      }

      // Update last_sync_at on success
      await this.prisma.integration.update({
        where: { id: integrationId },
        data: {
          last_sync_at: new Date(),
        },
      });

      this.logger.log(`Completed ${syncType} catalog sync for ${platform} integration ${integrationId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Catalog sync failed for ${integrationId}: ${errorMessage}`);
      throw error;
    }
  }

  private async syncShopifyCatalog(integrationId: string, syncType: string): Promise<void> {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || !integration.shop_domain) {
      throw new Error('Integration not found or missing shop domain');
    }

    this.logger.log(`Syncing Shopify catalog for ${integration.shop_domain} (${syncType})`);

    // Delegate to ShopifyService.initialSync which handles pagination, rate-limiting,
    // product upsert, and status transitions (pending → syncing → active)
    const result = await this.shopifyService.initialSync(integrationId);
    this.logger.log(`Shopify catalog sync complete: ${result.synced} products synced`);
  }

  private async syncWooCommerceCatalog(integrationId: string, syncType: string): Promise<void> {
    this.logger.log(`Syncing WooCommerce catalog for integration ${integrationId} (${syncType})`);

    const result = await this.wooCommerceService.initialSync(integrationId);
    this.logger.log(`WooCommerce catalog sync complete: ${result.synced} products synced`);
  }

  /**
   * Process attribution calculation - links orders to push campaigns
   */
  private async processAttributionCalculation(job: Job<AttributionCalculationJob>): Promise<void> {
    const { orderId, platform } = job.data;

    this.logger.log(`Calculating attribution for order ${orderId} (${platform})`);

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order || !order.device_id) {
        this.logger.warn(`Order ${orderId} not found or has no device for attribution`);
        return;
      }

      // Find recent deliveries to this device within attribution window
      const attributionWindowStart = new Date();
      attributionWindowStart.setHours(attributionWindowStart.getHours() - ATTRIBUTION_WINDOW_HOURS);

      const recentDeliveries = await this.prisma.delivery.findMany({
        where: {
          device_id: order.device_id,
          status: { in: ['delivered', 'opened', 'clicked'] },
          sent_at: { gte: attributionWindowStart },
        },
        orderBy: { sent_at: 'desc' },
        include: {
          campaign: true,
        },
      });

      if (recentDeliveries.length === 0) {
        this.logger.log(`No deliveries found for order ${orderId} attribution`);
        return;
      }

      // Use last-touch attribution: most recent delivery before order
      const orderCreatedAt = order.created_at;
      const attributedDelivery = recentDeliveries.find(
        (d: { sent_at: Date | null }) => d.sent_at && d.sent_at < orderCreatedAt,
      );

      if (attributedDelivery) {
        // Store attribution in order metadata
        const existingMetadata = (order.metadata as Record<string, unknown>) || {};
        await this.prisma.order.update({
          where: { id: orderId },
          data: {
            metadata: {
              ...existingMetadata,
              attribution: {
                type: 'push',
                delivery_id: attributedDelivery.id,
                campaign_id: attributedDelivery.campaign_id,
                automation_id: attributedDelivery.automation_id,
                attributed_at: new Date().toISOString(),
              },
            },
          },
        });

        this.logger.log(
          `Attributed order ${orderId} to delivery ${attributedDelivery.id} (campaign: ${attributedDelivery.campaign_id || 'automation'})`,
        );
      } else {
        this.logger.log(`No attributable delivery found for order ${orderId}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Attribution calculation failed for order ${orderId}: ${errorMessage}`);
      throw error;
    }
  }
}
