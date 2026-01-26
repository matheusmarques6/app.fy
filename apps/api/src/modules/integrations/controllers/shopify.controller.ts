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
  ShopifyCredentialsDto,
  ShopifyCredentialsResponseDto,
} from '../dto/shopify.dto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { QUEUE_NAMES } from '@appfy/shared';
import { createHash } from 'crypto';

// Stale threshold: log warning for webhooks older than 5 minutes (but still process)
const WEBHOOK_STALE_THRESHOLD_MS = 5 * 60 * 1000;

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
  // Credentials Management (per-store Shopify App)
  // ==========================================================================

  /**
   * Save Shopify App credentials for this store
   * POST /v1/integrations/shopify/credentials
   */
  @Post('credentials')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async saveCredentials(
    @Body() dto: ShopifyCredentialsDto,
    @Headers('x-store-id') storeId: string,
  ): Promise<{ success: boolean }> {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }

    // Debug logging - what arrived from frontend?
    this.logger.debug(`[saveCredentials] Received api_key length: ${dto.api_key?.length}`);
    this.logger.debug(`[saveCredentials] Received api_key preview: ${dto.api_key?.substring(0, 32)}...`);
    this.logger.debug(`[saveCredentials] Received api_secret length: ${dto.api_secret?.length}`);

    await this.shopifyService.saveCredentials(storeId, dto.api_key, dto.api_secret);
    return { success: true };
  }

  /**
   * Get Shopify App credentials status for this store
   * GET /v1/integrations/shopify/credentials
   */
  @Get('credentials')
  @UseGuards(JwtAuthGuard)
  async getCredentials(
    @Headers('x-store-id') storeId: string,
  ): Promise<ShopifyCredentialsResponseDto> {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }

    return this.shopifyService.getCredentialsStatus(storeId);
  }

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
    @Headers('x-store-id') storeId: string,
  ): Promise<ShopifyInstallResponseDto> {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }

    const { installUrl, state } = await this.shopifyService.generateInstallUrl(storeId, dto.shop);

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
    const consoleUrl = this.config.get<string>('CONSOLE_BASE_URL');

    // Decode state to get storeId for redirect
    let storeId: string | null = null;
    try {
      const decoded = JSON.parse(Buffer.from(dto.state, 'base64').toString());
      storeId = decoded.storeId;
    } catch {
      // State decode failed, will handle in error redirect
    }

    try {
      const { integrationId } = await this.shopifyService.handleOAuthCallback(dto);

      // Redirect to validation page
      res.redirect(
        `${consoleUrl}/integrations/shopify/callback?success=shopify&id=${integrationId}&store_id=${storeId}`,
      );
    } catch (error) {
      this.logger.error('OAuth callback failed', error);
      const errorRedirect = storeId
        ? `${consoleUrl}/integrations/shopify/callback?error=shopify_failed&store_id=${storeId}`
        : `${consoleUrl}/integrations/shopify/callback?error=shopify_failed`;
      res.redirect(errorRedirect);
    }
  }

  /**
   * Disconnect Shopify integration
   * POST /v1/integrations/shopify/disconnect
   */
  @Post('disconnect')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disconnect(@Headers('x-store-id') storeId: string): Promise<{ success: boolean }> {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
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
   * Connect Shopify manually with access token
   * POST /v1/integrations/shopify/connect-manual
   */
  @Post('connect-manual')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async connectManual(
    @Body() body: { shop_domain: string; access_token: string },
    @Headers('x-store-id') storeId: string,
  ): Promise<{ success: boolean; integration_id: string }> {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }

    if (!body.shop_domain || !body.access_token) {
      throw new BadRequestException('shop_domain and access_token are required');
    }

    const result = await this.shopifyService.connectManual(
      storeId,
      body.shop_domain,
      body.access_token,
    );

    return { success: true, integration_id: result.integrationId };
  }

  /**
   * Get Shopify integration status
   * GET /v1/integrations/shopify/status
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Headers('x-store-id') storeId: string): Promise<IntegrationResponseDto | null> {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
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

  /**
   * Get store preview data for App Builder
   * GET /v1/integrations/shopify/preview
   */
  @Get('preview')
  @UseGuards(JwtAuthGuard)
  async getStorePreview(@Headers('x-store-id') storeId: string) {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
    }

    return this.shopifyService.getStorePreview(storeId);
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
   * - Idempotency via X-Shopify-Event-Id (official recommendation)
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
    @Headers('x-shopify-event-id') eventId: string, // Official dedupe key
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

    // 3. Log stale webhooks but still process (delays can happen)
    if (triggeredAt) {
      const triggerTime = new Date(triggeredAt).getTime();
      const ageMs = Date.now() - triggerTime;
      if (ageMs > WEBHOOK_STALE_THRESHOLD_MS) {
        this.logger.warn(`Stale webhook ${eventId}: triggered ${Math.round(ageMs / 1000)}s ago`);
        // Continue processing - idempotency handles duplicates
      }
    }

    // 4. Get integration to find store_id
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
      select: { store_id: true, shop_domain: true },
    });

    if (!integration) {
      this.logger.warn(`Unknown integration ${integrationId}`);
      return { received: true }; // Still 200 to prevent retries
    }

    // Validate shop domain matches
    if (integration.shop_domain !== shopDomain) {
      this.logger.warn(`Shop domain mismatch: expected ${integration.shop_domain}, got ${shopDomain}`);
      return { received: true };
    }

    // 5. Use X-Shopify-Event-Id for dedupe (official Shopify recommendation)
    // Fallback: hash of topic + triggeredAt + payload (webhookId is subscription ID, not delivery ID)
    const dedupeKey = eventId || createHash('sha256')
      .update(`${topic}:${triggeredAt || ''}:${rawBodyStr}`)
      .digest('hex');

    // Check for duplicate using composite unique index (store_id, provider, webhook_event_id)
    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: {
        store_id_provider_webhook_event_id: {
          store_id: integration.store_id,
          provider: 'shopify',
          webhook_event_id: dedupeKey,
        },
      },
    });

    if (existingEvent) {
      this.logger.log(`Duplicate webhook ${dedupeKey} - ignoring`);
      return { received: true };
    }

    // 6. Record webhook event with status tracking
    await this.prisma.webhookEvent.create({
      data: {
        webhook_event_id: dedupeKey,
        store_id: integration.store_id,
        integration_id: integrationId,
        provider: 'shopify',
        topic,
        shop_domain: shopDomain,
        status: 'received',
        received_at: new Date(),
      },
    });

    // 7. Enqueue for async processing (ack fast)
    await this.integrationsQueue.add(
      'shopify-webhook',
      {
        webhookEventId: dedupeKey,
        storeId: integration.store_id,
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

    this.logger.log(`Webhook ${dedupeKey} (${topic}) queued for processing`);
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
  async triggerSync(@Headers('x-store-id') storeId: string): Promise<{ queued: boolean }> {
    if (!storeId) {
      throw new BadRequestException('X-Store-Id header is required');
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

    // Queue catalog sync job
    await this.integrationsQueue.add('catalog-sync', {
      storeId,
      integrationId: integration.id,
      platform: 'shopify',
      syncType: 'full',
    });

    this.logger.log(`Queued catalog sync for Shopify integration ${integration.id}`);

    return { queued: true };
  }
}
