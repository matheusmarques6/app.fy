import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  RawBodyRequest,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WooCommerceService } from '../services/woocommerce.service';
import { WooCommerceConnectDto } from '../dto/woocommerce.dto';
import { IntegrationResponseDto } from '../dto/shopify.dto';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Controller('integrations/woocommerce')
export class WooCommerceController {
  private readonly logger = new Logger(WooCommerceController.name);

  constructor(
    private readonly wooService: WooCommerceService,
    private readonly prisma: PrismaService,
  ) {}

  // ==========================================================================
  // Connection Endpoints
  // ==========================================================================

  /**
   * Connect WooCommerce store
   * POST /v1/integrations/woocommerce/connect
   */
  @Post('connect')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async connect(
    @Body() dto: WooCommerceConnectDto,
    @Req() req: Request,
  ): Promise<{ integration_id: string }> {
    const storeId = req.user?.['store_id'];
    if (!storeId) {
      throw new BadRequestException('Store ID required');
    }

    const { integrationId } = await this.wooService.connect(storeId, dto);

    return { integration_id: integrationId };
  }

  /**
   * Disconnect WooCommerce integration
   * POST /v1/integrations/woocommerce/disconnect
   */
  @Post('disconnect')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disconnect(@Req() req: Request): Promise<{ success: boolean }> {
    const storeId = req.user?.['store_id'];
    if (!storeId) {
      throw new BadRequestException('Store ID required');
    }

    await this.prisma.integration.updateMany({
      where: {
        store_id: storeId,
        platform: 'woocommerce',
      },
      data: {
        status: 'disconnected',
        access_token_ref: null,
        refresh_token_ref: null,
      },
    });

    return { success: true };
  }

  /**
   * Get WooCommerce integration status
   * GET /v1/integrations/woocommerce/status
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: Request): Promise<IntegrationResponseDto | null> {
    const storeId = req.user?.['store_id'];
    if (!storeId) {
      throw new BadRequestException('Store ID required');
    }

    const integration = await this.prisma.integration.findUnique({
      where: {
        store_id_platform: {
          store_id: storeId,
          platform: 'woocommerce',
        },
      },
    });

    if (!integration) {
      return null;
    }

    return {
      id: integration.id,
      platform: integration.platform,
      status: integration.status,
      shop_domain: integration.shop_domain || undefined,
      scopes: integration.scopes,
      last_sync_at: integration.last_sync_at || undefined,
      created_at: integration.created_at,
    };
  }

  // ==========================================================================
  // Webhook Endpoints
  // ==========================================================================

  /**
   * Handle WooCommerce webhooks
   * POST /v1/integrations/woocommerce/webhooks/:integrationId
   */
  @Post('webhooks/:integrationId')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('integrationId') integrationId: string,
    @Headers('x-wc-webhook-topic') topic: string,
    @Headers('x-wc-webhook-signature') signature: string,
    @Headers('x-wc-webhook-delivery-id') deliveryId: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: boolean }> {
    // Get raw body for signature validation
    const rawBody = req.rawBody?.toString('utf8');
    if (!rawBody) {
      throw new BadRequestException('Missing request body');
    }

    // Get integration to find webhook secret
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new UnauthorizedException('Invalid integration');
    }

    // Get webhook secret from integration metadata
    const webhookSecret = (integration.metadata as any)?.webhook_secret;

    // Validate signature if we have a secret
    if (webhookSecret && signature) {
      if (!this.wooService.validateWebhookSignature(rawBody, signature, webhookSecret)) {
        this.logger.warn(`Invalid WooCommerce webhook signature for integration ${integrationId}`);
        throw new UnauthorizedException('Invalid signature');
      }
    }

    // Check for duplicate (idempotency)
    if (deliveryId) {
      const existingEvent = await this.prisma.webhookEvent.findUnique({
        where: { webhook_event_id: deliveryId },
      });

      if (existingEvent) {
        this.logger.log(`Duplicate WooCommerce webhook ${deliveryId} - ignoring`);
        return { received: true };
      }

      // Record webhook event
      await this.prisma.webhookEvent.create({
        data: {
          webhook_event_id: deliveryId,
          integration_id: integrationId,
          topic,
          processed_at: new Date(),
        },
      });
    }

    // Process webhook
    const payload = JSON.parse(rawBody);

    try {
      await this.wooService.processWebhook(integrationId, topic, payload);
    } catch (error) {
      this.logger.error(`WooCommerce webhook processing failed: ${topic}`, error);
    }

    return { received: true };
  }

  // ==========================================================================
  // Sync Endpoints
  // ==========================================================================

  /**
   * Trigger manual sync
   * POST /v1/integrations/woocommerce/sync
   */
  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerSync(@Req() req: Request): Promise<{ queued: boolean }> {
    const storeId = req.user?.['store_id'];
    if (!storeId) {
      throw new BadRequestException('Store ID required');
    }

    const integration = await this.prisma.integration.findUnique({
      where: {
        store_id_platform: {
          store_id: storeId,
          platform: 'woocommerce',
        },
      },
    });

    if (!integration || integration.status !== 'active') {
      throw new BadRequestException('WooCommerce not connected');
    }

    // TODO: Queue sync job

    return { queued: true };
  }
}
