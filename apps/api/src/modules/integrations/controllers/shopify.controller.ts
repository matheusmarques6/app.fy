import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  RawBodyRequest,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ShopifyService } from '../services/shopify.service';
import {
  ShopifyInstallDto,
  ShopifyOAuthCallbackDto,
  ShopifyInstallResponseDto,
  IntegrationResponseDto,
} from '../dto/shopify.dto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { QUEUE_NAMES } from '@appfy/shared';

// Replay window: reject webhooks older than 5 minutes
const WEBHOOK_REPLAY_WINDOW_MS = 5 * 60 * 1000;

@Controller('integrations/shopify')
export class ShopifyController {
  private readonly logger = new Logger(ShopifyController.name);

  constructor(
    private readonly shopifyService: ShopifyService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.INTEGRATIONS_SYNC)
    private readonly integrationsQueue: Queue,
  ) {}

  // ==========================================================================
  // OAuth Endpoints
  // ==========================================================================

  /**
   * Start Shopify OAuth flow
   * POST /v1/integrations/shopify/install
   */
  @Post('install')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async install(
    @Body() dto: ShopifyInstallDto,
    @Req() req: Request,
  ): Promise<ShopifyInstallResponseDto> {
    const storeId = req.user?.['store_id'];
    if (!storeId) {
      throw new BadRequestException('Store ID required');
    }

    const { installUrl, state } = this.shopifyService.generateInstallUrl(storeId, dto.shop);

    return { install_url: installUrl, state };
  }

  /**
   * Handle Shopify OAuth callback
   * GET /v1/integrations/shopify/callback
   */
  @Get('callback')
  async oauthCallback(
    @Query() dto: ShopifyOAuthCallbackDto,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { integrationId } = await this.shopifyService.handleOAuthCallback(dto);

      // Redirect to console with success
      const consoleUrl = this.config.get<string>('CONSOLE_BASE_URL');
      res.redirect(`${consoleUrl}/settings/integrations?success=shopify&id=${integrationId}`);
    } catch (error) {
      this.logger.error('OAuth callback failed', error);
      const consoleUrl = this.config.get<string>('CONSOLE_BASE_URL');
      res.redirect(`${consoleUrl}/settings/integrations?error=shopify_failed`);
    }
  }

  /**
   * Disconnect Shopify integration
   * POST /v1/integrations/shopify/disconnect
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
        platform: 'shopify',
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
   * Get Shopify integration status
   * GET /v1/integrations/shopify/status
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
          platform: 'shopify',
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
   * Handle Shopify webhooks
   * POST /v1/integrations/shopify/webhooks/:integrationId
   *
   * Security:
   * - HMAC validation using raw body
   * - Replay window validation (5 min)
   * - Idempotency via webhook_event_id
   *
   * Performance:
   * - Ack fast (respond 200)
   * - Process async via queue
   */
  @Post('webhooks/:integrationId')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('integrationId') integrationId: string,
    @Headers('x-shopify-topic') topic: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
    @Headers('x-shopify-hmac-sha256') hmacHeader: string,
    @Headers('x-shopify-webhook-id') webhookId: string,
    @Headers('x-shopify-triggered-at') triggeredAt: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: boolean }> {
    // 1. Get raw body for HMAC validation (CRITICAL: use raw bytes, not parsed JSON)
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing request body');
    }
    const rawBodyStr = rawBody.toString('utf8');

    // 2. Validate HMAC signature using raw body
    if (!this.shopifyService.validateWebhookSignature(rawBodyStr, hmacHeader)) {
      this.logger.warn(`Invalid webhook signature from ${shopDomain}`);
      throw new UnauthorizedException('Invalid signature');
    }

    // 3. Validate replay window (reject webhooks older than 5 minutes)
    if (triggeredAt) {
      const triggerTime = new Date(triggeredAt).getTime();
      const now = Date.now();
      if (now - triggerTime > WEBHOOK_REPLAY_WINDOW_MS) {
        this.logger.warn(`Webhook ${webhookId} rejected: too old (triggered at ${triggeredAt})`);
        // Still return 200 to prevent Shopify from retrying
        return { received: true };
      }
    }

    // 4. Check for duplicate (idempotency)
    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: { webhook_event_id: webhookId },
    });

    if (existingEvent) {
      this.logger.log(`Duplicate webhook ${webhookId} - ignoring`);
      return { received: true };
    }

    // 5. Record webhook event with status tracking
    const payloadHash = this.shopifyService.hashPayload(rawBodyStr);
    await this.prisma.webhookEvent.create({
      data: {
        webhook_event_id: webhookId,
        integration_id: integrationId,
        provider: 'shopify',
        topic,
        shop_domain: shopDomain,
        status: 'received',
        payload_hash: payloadHash,
        received_at: new Date(),
      },
    });

    // 6. Enqueue for async processing (ack fast)
    await this.integrationsQueue.add(
      'shopify-webhook',
      {
        webhookEventId: webhookId,
        integrationId,
        topic,
        shopDomain,
        payload: JSON.parse(rawBodyStr),
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    );

    this.logger.log(`Webhook ${webhookId} (${topic}) queued for processing`);
    return { received: true };
  }

  // ==========================================================================
  // Sync Endpoints
  // ==========================================================================

  /**
   * Trigger manual sync
   * POST /v1/integrations/shopify/sync
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
          platform: 'shopify',
        },
      },
    });

    if (!integration || integration.status !== 'active') {
      throw new BadRequestException('Shopify not connected');
    }

    // TODO: Queue sync job
    // await this.queueService.add('integrations_sync', { integrationId: integration.id });

    return { queued: true };
  }
}
