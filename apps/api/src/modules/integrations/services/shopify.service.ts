import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHmac, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual, createHash, scryptSync } from 'crypto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { QUEUE_NAMES } from '@appfy/shared';
import {
  ShopifyOAuthCallbackDto,
  ShopifyProductDto,
  ShopifyOrderDto,
  ShopifyCustomerDto,
} from '../dto/shopify.dto';

// Replay window: webhooks older than this are rejected (5 minutes)
const WEBHOOK_REPLAY_WINDOW_MS = 5 * 60 * 1000;
// OAuth state expiration (10 minutes)
const STATE_EXPIRATION_MS = 10 * 60 * 1000;
// Rate limit retry config
const MAX_API_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
// Encryption algorithm
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);
  private readonly apiVersion = '2024-01';
  private readonly scopes = [
    'read_products',
    'read_orders',
    'read_customers',
    'read_inventory',
    'read_fulfillments',
  ];
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.INTEGRATIONS_SYNC)
    private readonly integrationsQueue: Queue,
  ) {
    // Derive encryption key from secret
    const secret = this.config.get<string>('ENCRYPTION_SECRET') || 'default-encryption-secret-change-me';
    this.encryptionKey = scryptSync(secret, 'salt', 32);
  }

  // ==========================================================================
  // OAuth Flow
  // ==========================================================================

  /**
   * Generate Shopify OAuth install URL
   * Uses centralized credentials from environment variables
   */
  async generateInstallUrl(storeId: string, shop: string): Promise<{ installUrl: string; state: string }> {
    const clientId = this.config.get<string>('SHOPIFY_CLIENT_ID');
    const redirectUri = this.config.get<string>('SHOPIFY_REDIRECT_URI');

    if (!clientId) {
      throw new BadRequestException('SHOPIFY_CLIENT_ID não configurado no sistema');
    }
    if (!redirectUri) {
      throw new BadRequestException('SHOPIFY_REDIRECT_URI não configurado no sistema');
    }

    // Validate and normalize shop domain
    const normalizedShop = this.normalizeShopDomain(shop);
    if (!this.isValidShopDomain(normalizedShop)) {
      throw new BadRequestException('Domínio Shopify inválido');
    }

    // Generate state with nonce and timestamp for anti-CSRF + expiration
    const nonce = randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const state = Buffer.from(JSON.stringify({ storeId, nonce, timestamp })).toString('base64');

    const installUrl = `https://${normalizedShop}/admin/oauth/authorize?` +
      `client_id=${clientId}&` +
      `scope=${this.scopes.join(',')}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${state}`;

    return { installUrl, state };
  }

  /**
   * Validate shop domain is a valid Shopify domain
   */
  private isValidShopDomain(shop: string): boolean {
    // Must end with .myshopify.com
    const shopifyDomainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
    return shopifyDomainRegex.test(shop);
  }

  /**
   * Handle OAuth callback and exchange code for access token
   */
  async handleOAuthCallback(dto: ShopifyOAuthCallbackDto): Promise<{ integrationId: string }> {
    const { code, shop, state, hmac, timestamp } = dto;

    // 1. Validate shop domain is valid *.myshopify.com
    if (!this.isValidShopDomain(shop)) {
      this.logger.warn(`Invalid shop domain in OAuth callback: ${shop}`);
      throw new BadRequestException('Invalid shop domain');
    }

    // 2. Decode state first to get storeId (needed to fetch credentials)
    let storeId: string;
    let stateTimestamp: number;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
      storeId = decoded.storeId;
      stateTimestamp = decoded.timestamp;
    } catch (e) {
      throw new BadRequestException('Invalid state parameter');
    }

    // 3. Validate HMAC signature using centralized credentials
    if (!hmac) {
      throw new BadRequestException('Missing HMAC signature');
    }
    this.validateHmac({ code, shop, state, timestamp }, hmac);

    // 4. Validate timestamps
    if (timestamp) {
      const callbackTimestamp = parseInt(timestamp, 10) * 1000; // Convert to ms
      if (Date.now() - callbackTimestamp > STATE_EXPIRATION_MS) {
        throw new BadRequestException('OAuth callback expired');
      }
    }

    // Validate state hasn't expired
    if (stateTimestamp && Date.now() - stateTimestamp > STATE_EXPIRATION_MS) {
      throw new BadRequestException('OAuth state expired');
    }

    // Exchange code for access token (using centralized credentials)
    const accessToken = await this.exchangeCodeForToken(shop, code);

    // Get shop info
    const shopInfo = await this.getShopInfo(shop, accessToken);

    // Save integration
    const integration = await this.prisma.integration.upsert({
      where: {
        store_id_platform: {
          store_id: storeId,
          platform: 'shopify',
        },
      },
      create: {
        store_id: storeId,
        platform: 'shopify',
        status: 'active',
        shop_domain: shop,
        access_token_ref: this.encryptToken(accessToken), // In production, use KMS
        scopes: this.scopes,
        metadata: {
          shop_id: shopInfo.id,
          shop_name: shopInfo.name,
          shop_email: shopInfo.email,
          currency: shopInfo.currency,
          timezone: shopInfo.timezone,
        },
      },
      update: {
        status: 'active',
        access_token_ref: this.encryptToken(accessToken),
        scopes: this.scopes,
        metadata: {
          shop_id: shopInfo.id,
          shop_name: shopInfo.name,
          shop_email: shopInfo.email,
          currency: shopInfo.currency,
          timezone: shopInfo.timezone,
        },
        updated_at: new Date(),
      },
    });

    // Register webhooks
    await this.registerWebhooks(integration.id, shop, accessToken);

    // Trigger initial sync
    // TODO: Queue initial catalog sync job

    return { integrationId: integration.id };
  }

  /**
   * Connect Shopify using Client Credentials (new Shopify Dev Dashboard method)
   * Takes Client ID and Client Secret, generates access token via Client Credentials Grant
   */
  async connectManual(
    storeId: string,
    shopDomain: string,
    clientId: string,
    clientSecret: string,
  ): Promise<{ integrationId: string }> {
    // Normalize shop domain
    const shop = this.normalizeShopDomain(shopDomain);

    // Generate access token using client credentials grant
    let accessToken: string;
    try {
      this.logger.log(`Generating access token for shop: ${shop} using client credentials`);
      accessToken = await this.getAccessTokenFromCredentials(shop, clientId, clientSecret);
      this.logger.log(`Access token generated successfully`);
    } catch (error: any) {
      this.logger.error(`Failed to generate access token for shop ${shop}: ${error?.message || error}`);
      throw new BadRequestException(
        'Credenciais inválidas. Verifique se o Client ID e Client Secret estão corretos e se o app está instalado na loja.',
      );
    }

    // Verify the token works by fetching shop info
    let shopInfo: any;
    try {
      this.logger.log(`Verifying token for shop: ${shop}`);
      shopInfo = await this.getShopInfo(shop, accessToken);
      this.logger.log(`Shop info retrieved: ${shopInfo?.name}`);
    } catch (error: any) {
      this.logger.error(`Invalid Shopify token for shop ${shop}: ${error?.message || error}`);

      // Check for common issues
      if (error?.message?.includes('401')) {
        throw new BadRequestException(
          'Token gerado mas inválido. Verifique as permissões do app no Shopify.',
        );
      }
      if (error?.message?.includes('403')) {
        throw new BadRequestException(
          'Token não tem permissões suficientes. Certifique-se de que o app tem acesso a "read_products".',
        );
      }
      if (error?.message?.includes('404')) {
        throw new BadRequestException(
          'Loja não encontrada. Verifique se o domínio está correto.',
        );
      }

      throw new BadRequestException(
        'Erro ao validar conexão. Verifique as credenciais e permissões do app.',
      );
    }

    // Save integration
    const integration = await this.prisma.integration.upsert({
      where: {
        store_id_platform: {
          store_id: storeId,
          platform: 'shopify',
        },
      },
      create: {
        store_id: storeId,
        platform: 'shopify',
        status: 'active',
        shop_domain: shop,
        access_token_ref: this.encryptToken(accessToken),
        scopes: this.scopes,
        metadata: {
          shop_name: shopInfo.name,
          shop_email: shopInfo.email,
          currency: shopInfo.currency,
          timezone: shopInfo.timezone,
          connected_via: 'manual',
        },
      },
      update: {
        status: 'active',
        shop_domain: shop,
        access_token_ref: this.encryptToken(accessToken),
        scopes: this.scopes,
        metadata: {
          shop_name: shopInfo.name,
          shop_email: shopInfo.email,
          currency: shopInfo.currency,
          timezone: shopInfo.timezone,
          connected_via: 'manual',
        },
        updated_at: new Date(),
      },
    });

    this.logger.log(`Shopify manually connected for store ${storeId}: ${shop}`);

    return { integrationId: integration.id };
  }

  /**
   * Exchange authorization code for access token
   * Uses centralized credentials from environment variables
   */
  private async exchangeCodeForToken(shop: string, code: string): Promise<string> {
    const clientId = this.config.get<string>('SHOPIFY_CLIENT_ID');
    const clientSecret = this.config.get<string>('SHOPIFY_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Credenciais Shopify não configuradas no sistema');
    }

    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to exchange code: ${error}`);
      throw new BadRequestException('Failed to complete Shopify authorization');
    }

    const data = await response.json() as { access_token: string };
    return data.access_token;
  }

  /**
   * Get access token using Client Credentials Grant (new Shopify Dev Dashboard method)
   * https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials
   */
  private async getAccessTokenFromCredentials(
    shop: string,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    // Create Basic Auth header from client credentials
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Failed to get access token via client credentials: ${response.status} - ${errorText}`);
      throw new Error(`Failed to get access token: ${response.status}`);
    }

    const data = await response.json() as { access_token: string };
    return data.access_token;
  }

  /**
   * Get shop information
   */
  private async getShopInfo(shop: string, accessToken: string): Promise<any> {
    const response = await this.shopifyApiRequest(shop, accessToken, 'GET', '/shop.json');
    return response.shop;
  }

  // ==========================================================================
  // Webhooks
  // ==========================================================================

  /**
   * Register all required webhooks
   * Returns summary of registration results
   */
  async registerWebhooks(
    integrationId: string,
    shop: string,
    accessToken: string,
  ): Promise<{ registered: string[]; failed: string[] }> {
    const webhookBaseUrl = this.config.get<string>('WEBHOOK_BASE_URL');

    const topics = [
      'orders/create',
      'orders/updated',
      'orders/paid',
      'orders/cancelled',
      'products/create',
      'products/update',
      'products/delete',
      'customers/create',
      'customers/update',
      'app/uninstalled',
    ];

    const registered: string[] = [];
    const failed: string[] = [];

    for (const topic of topics) {
      try {
        const address = `${webhookBaseUrl}/v1/integrations/shopify/webhooks/${integrationId}`;

        const response = await this.shopifyApiRequest(shop, accessToken, 'POST', '/webhooks.json', {
          webhook: {
            topic,
            address,
            format: 'json',
          },
        });

        // Save webhook registration
        await this.prisma.integrationWebhook.upsert({
          where: {
            integration_id_topic: {
              integration_id: integrationId,
              topic,
            },
          },
          create: {
            integration_id: integrationId,
            topic,
            webhook_id: response.webhook?.id?.toString(),
            address,
            status: 'active',
          },
          update: {
            webhook_id: response.webhook?.id?.toString(),
            address,
            status: 'active',
          },
        });

        registered.push(topic);
        this.logger.log(`Registered webhook: ${topic} for integration ${integrationId}`);
      } catch (error) {
        failed.push(topic);
        this.logger.error(`Failed to register webhook ${topic}:`, error);

        // Track failed webhook in database
        const address = `${webhookBaseUrl}/v1/integrations/shopify/webhooks/${integrationId}`;
        await this.prisma.integrationWebhook.upsert({
          where: {
            integration_id_topic: {
              integration_id: integrationId,
              topic,
            },
          },
          create: {
            integration_id: integrationId,
            topic,
            address,
            status: 'failed',
          },
          update: {
            status: 'failed',
          },
        }).catch(() => {}); // Don't fail if we can't track the failure
      }
    }

    // Log summary
    this.logger.log(
      `Webhook registration complete for ${integrationId}: ${registered.length} registered, ${failed.length} failed`,
    );

    return { registered, failed };
  }

  /**
   * Validate webhook HMAC signature
   */
  validateWebhookSignature(body: string, hmacHeader: string): boolean {
    const clientSecret = this.config.get<string>('SHOPIFY_CLIENT_SECRET');
    if (!clientSecret) return false;

    const hash = createHmac('sha256', clientSecret)
      .update(body, 'utf8')
      .digest('base64');

    try {
      return timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
    } catch {
      return false;
    }
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(
    integrationId: string,
    topic: string,
    shopDomain: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(`Processing webhook: ${topic} from ${shopDomain}`);

    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
      include: { store: true },
    });

    if (!integration || integration.shop_domain !== shopDomain) {
      throw new UnauthorizedException('Invalid integration');
    }

    switch (topic) {
      case 'orders/create':
      case 'orders/updated':
        await this.handleOrderWebhook(integration.store_id, payload as ShopifyOrderDto, 'created');
        break;

      case 'orders/paid':
        await this.handleOrderWebhook(integration.store_id, payload as ShopifyOrderDto, 'paid');
        break;

      case 'orders/cancelled':
        await this.handleOrderWebhook(integration.store_id, payload as ShopifyOrderDto, 'cancelled');
        break;

      case 'products/create':
      case 'products/update':
        await this.handleProductWebhook(integration.store_id, payload as ShopifyProductDto, 'upsert');
        break;

      case 'products/delete':
        await this.handleProductWebhook(integration.store_id, payload as ShopifyProductDto, 'delete');
        break;

      case 'customers/create':
      case 'customers/update':
        await this.handleCustomerWebhook(integration.store_id, payload as ShopifyCustomerDto);
        break;

      case 'app/uninstalled':
        await this.handleUninstall(integrationId);
        break;

      default:
        this.logger.warn(`Unhandled webhook topic: ${topic}`);
    }
  }

  // ==========================================================================
  // Webhook Handlers
  // ==========================================================================

  /**
   * Handle order webhook - CRITICAL for attribution
   */
  private async handleOrderWebhook(
    storeId: string,
    order: ShopifyOrderDto,
    action: 'created' | 'paid' | 'cancelled',
  ): Promise<void> {
    this.logger.log(`Processing order ${order.id} (${action}) for store ${storeId}`);

    // Convert price to minor units (centavos)
    const totalAmountMinor = Math.round(parseFloat(order.total_price) * 100);
    const subtotalAmountMinor = Math.round(parseFloat(order.subtotal_price) * 100);

    // Upsert order
    const dbOrder = await this.prisma.order.upsert({
      where: {
        store_id_order_id: {
          store_id: storeId,
          order_id: order.id.toString(),
        },
      },
      create: {
        store_id: storeId,
        order_id: order.id.toString(),
        order_number: order.order_number.toString(),
        external_customer_id: order.customer?.id?.toString(),
        email_hash: order.email ? this.hashEmail(order.email) : null,
        status: action === 'paid' ? 'paid' : action === 'cancelled' ? 'cancelled' : 'created',
        source: 'webhook',
        total_amount_minor: totalAmountMinor,
        subtotal_amount_minor: subtotalAmountMinor,
        currency: order.currency,
        items_count: order.line_items.length,
        metadata: {
          financial_status: order.financial_status,
          fulfillment_status: order.fulfillment_status,
          line_items: order.line_items.map(item => ({
            product_id: item.product_id,
            variant_id: item.variant_id,
            title: item.title,
            quantity: item.quantity,
            price_minor: Math.round(parseFloat(item.price) * 100),
          })),
          discount_codes: order.discount_codes,
        },
      },
      update: {
        // Only update status if action explicitly sets it (paid/cancelled)
        ...(action === 'paid' ? { status: 'paid' } : {}),
        ...(action === 'cancelled' ? { status: 'cancelled' } : {}),
        source: 'merged', // Webhook vence
        total_amount_minor: totalAmountMinor,
        subtotal_amount_minor: subtotalAmountMinor,
        metadata: {
          financial_status: order.financial_status,
          fulfillment_status: order.fulfillment_status,
          line_items: order.line_items.map(item => ({
            product_id: item.product_id,
            variant_id: item.variant_id,
            title: item.title,
            quantity: item.quantity,
            price_minor: Math.round(parseFloat(item.price) * 100),
          })),
          discount_codes: order.discount_codes,
        },
        updated_at: new Date(),
      },
    });

    // If order is paid, queue attribution calculation
    if (action === 'paid') {
      await this.integrationsQueue.add('attribution-calculation', {
        storeId,
        orderId: dbOrder.id,
        platform: 'shopify',
      });
      this.logger.log(`Order ${order.id} paid - queued attribution calculation`);
    }

    // Link order to device/customer if we can find them
    if (order.email) {
      await this.linkOrderToDevice(storeId, dbOrder.id, order.email);
    }
  }

  /**
   * Handle product webhook
   */
  private async handleProductWebhook(
    storeId: string,
    product: ShopifyProductDto,
    action: 'upsert' | 'delete',
  ): Promise<void> {
    this.logger.log(`Processing product ${product.id} (${action}) for store ${storeId}`);

    if (action === 'delete') {
      // Soft delete - mark as inactive
      // TODO: Implement product table and soft delete
      return;
    }

    // TODO: Implement product sync
    // For now, just log
    this.logger.log(`Product ${product.id}: ${product.title}`);
  }

  /**
   * Handle customer webhook
   */
  private async handleCustomerWebhook(
    storeId: string,
    customer: ShopifyCustomerDto,
  ): Promise<void> {
    this.logger.log(`Processing customer ${customer.id} for store ${storeId}`);

    // Update customer record if exists
    // This helps with identity linking
    if (customer.email) {
      const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || null;

      await this.prisma.customer.upsert({
        where: {
          store_id_external_customer_id: {
            store_id: storeId,
            external_customer_id: customer.id.toString(),
          },
        },
        create: {
          store_id: storeId,
          external_customer_id: customer.id.toString(),
          email_encrypted: this.encryptPii(customer.email),
          email_hash: this.hashEmail(customer.email),
          phone_encrypted: customer.phone ? this.encryptPii(customer.phone) : null,
          name_encrypted: fullName ? this.encryptPii(fullName) : null,
          metadata: {
            orders_count: customer.orders_count,
            total_spent: customer.total_spent,
            tags: customer.tags,
          },
        },
        update: {
          email_encrypted: this.encryptPii(customer.email),
          phone_encrypted: customer.phone ? this.encryptPii(customer.phone) : null,
          name_encrypted: fullName ? this.encryptPii(fullName) : null,
          metadata: {
            orders_count: customer.orders_count,
            total_spent: customer.total_spent,
            tags: customer.tags,
          },
          updated_at: new Date(),
        },
      });
    }
  }

  /**
   * Handle app uninstall - full cleanup
   */
  private async handleUninstall(integrationId: string): Promise<void> {
    this.logger.log(`App uninstalled for integration ${integrationId}`);

    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) return;

    const storeId = integration.store_id;

    // Use transaction for atomic cleanup
    await this.prisma.$transaction(async (tx) => {
      // 1. Mark integration as disconnected and clear tokens
      await tx.integration.update({
        where: { id: integrationId },
        data: {
          status: 'disconnected',
          access_token_ref: null,
          refresh_token_ref: null,
          metadata: {
            ...(integration.metadata as object || {}),
            uninstalled_at: new Date().toISOString(),
          },
        },
      });

      // 2. Mark all webhooks as inactive
      await tx.integrationWebhook.updateMany({
        where: { integration_id: integrationId },
        data: { status: 'inactive' },
      });

      // 3. Pause all automations for this store
      await tx.automation.updateMany({
        where: {
          store_id: storeId,
          status: 'active',
        },
        data: { status: 'paused' },
      });

      // 4. Cancel pending campaigns
      await tx.campaign.updateMany({
        where: {
          store_id: storeId,
          status: 'scheduled',
        },
        data: { status: 'cancelled' },
      });
    });

    this.logger.log(`Cleanup completed for uninstalled integration ${integrationId}`);
  }

  // ==========================================================================
  // API Methods
  // ==========================================================================

  /**
   * Make Shopify API request with rate limiting and exponential backoff
   */
  private async shopifyApiRequest(
    shop: string,
    accessToken: string,
    method: string,
    endpoint: string,
    body?: any,
    retryCount = 0,
  ): Promise<any> {
    const url = `https://${shop}/admin/api/${this.apiVersion}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle rate limiting (429) and server errors (5xx) with exponential backoff
    if ((response.status === 429 || response.status >= 500) && retryCount < MAX_API_RETRIES) {
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
      const retryAfter = response.headers.get('Retry-After');
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoffMs;

      this.logger.warn(`Shopify API rate limited (${response.status}), retrying in ${waitMs}ms (attempt ${retryCount + 1}/${MAX_API_RETRIES})`);

      await this.sleep(waitMs);
      return this.shopifyApiRequest(shop, accessToken, method, endpoint, body, retryCount + 1);
    }

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Shopify API error: ${response.status} - ${errorText}`);
      throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get integration access token
   */
  async getAccessToken(integrationId: string): Promise<string> {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration?.access_token_ref) {
      throw new UnauthorizedException('Integration not connected');
    }

    return this.decryptToken(integration.access_token_ref);
  }

  /**
   * Get store preview data for App Builder (logo, products, etc.)
   */
  async getStorePreview(storeId: string): Promise<{
    connected: boolean;
    shop?: {
      name: string;
      domain: string;
      logo?: string;
      currency: string;
    };
    products: Array<{
      id: string;
      title: string;
      image?: string;
      price: string;
      currency: string;
    }>;
  }> {
    const integration = await this.prisma.integration.findUnique({
      where: {
        store_id_platform: {
          store_id: storeId,
          platform: 'shopify',
        },
      },
    });

    if (!integration || integration.status !== 'active' || !integration.access_token_ref) {
      return { connected: false, products: [] };
    }

    const accessToken = this.decryptToken(integration.access_token_ref);
    const shop = integration.shop_domain!;

    try {
      // Fetch shop info
      const shopInfo = await this.getShopInfo(shop, accessToken);

      // Fetch products (limit 8 for preview)
      const productsResponse = await this.shopifyApiRequest(
        shop,
        accessToken,
        'GET',
        '/products.json?limit=8&status=active',
      );

      const products = (productsResponse.products || []).map((p: any) => ({
        id: p.id.toString(),
        title: p.title,
        image: p.image?.src || p.images?.[0]?.src,
        price: p.variants?.[0]?.price || '0.00',
        currency: shopInfo.currency || 'BRL',
      }));

      return {
        connected: true,
        shop: {
          name: shopInfo.name,
          domain: integration.shop_domain!,
          logo: shopInfo.logo?.url || undefined,
          currency: shopInfo.currency,
        },
        products,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch store preview: ${error}`);
      return { connected: true, products: [] };
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private normalizeShopDomain(shop: string): string {
    // Remove protocol if present
    let normalized = shop.replace(/^https?:\/\//, '');
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    // Add .myshopify.com if not present
    if (!normalized.includes('.myshopify.com')) {
      normalized = `${normalized}.myshopify.com`;
    }
    return normalized;
  }

  private validateHmac(params: Record<string, string | undefined>, hmac: string): void {
    const clientSecret = this.config.get<string>('SHOPIFY_CLIENT_SECRET');
    if (!clientSecret) {
      throw new BadRequestException('SHOPIFY_CLIENT_SECRET não configurado no sistema');
    }

    // Build query string (sorted, without hmac)
    const entries = Object.entries(params)
      .filter(([key, value]) => key !== 'hmac' && value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));

    const message = entries.map(([key, value]) => `${key}=${value}`).join('&');

    const hash = createHmac('sha256', clientSecret)
      .update(message)
      .digest('hex');

    if (hash !== hmac) {
      throw new UnauthorizedException('Invalid HMAC');
    }
  }

  private hashEmail(email: string): string {
    const salt = this.config.get<string>('EMAIL_HASH_SALT') || 'email-hash-salt';
    return createHmac('sha256', salt)
      .update(email.toLowerCase().trim())
      .digest('hex');
  }

  /**
   * Encrypt token using AES-256-GCM
   * Format: iv:authTag:encryptedData (all base64)
   */
  private encryptToken(token: string): string {
    this.logger.debug(`[encryptToken] Input length: ${token.length}`);

    const iv = randomBytes(16);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);

    let encrypted = cipher.update(token, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    const result = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    this.logger.debug(`[encryptToken] Output: ${result}`);
    this.logger.debug(`[encryptToken] Output length: ${result.length}, has 2 colons: ${(result.match(/:/g) || []).length === 2}`);

    return result;
  }

  /**
   * Decrypt token using AES-256-GCM
   */
  private decryptToken(encrypted: string): string {
    const parts = encrypted.split(':');

    this.logger.debug(`[decryptToken] Parts count: ${parts.length}`);

    // Fallback for legacy base64-only tokens
    if (parts.length === 1) {
      this.logger.debug(`[decryptToken] Using legacy base64 fallback`);
      const decoded = Buffer.from(encrypted, 'base64').toString();
      this.logger.debug(`[decryptToken] Decoded legacy value length: ${decoded.length}`);
      return decoded;
    }

    const [ivB64, authTagB64, data] = parts;
    this.logger.debug(`[decryptToken] IV length: ${ivB64.length}, AuthTag length: ${authTagB64.length}, Data length: ${data.length}`);

    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    this.logger.debug(`[decryptToken] Decrypted length: ${decrypted.length}`);

    return decrypted;
  }

  /**
   * Hash payload for replay detection
   */
  hashPayload(payload: string): string {
    return createHash('sha256').update(payload).digest('hex');
  }

  private encryptPii(value: string): string {
    // Simple base64 for now - use proper encryption in production
    return Buffer.from(value).toString('base64');
  }

  private async linkOrderToDevice(storeId: string, orderId: string, email: string): Promise<void> {
    const emailHash = this.hashEmail(email);

    // Find device linked to this email hash
    const device = await this.prisma.device.findFirst({
      where: {
        store_id: storeId,
        customer: {
          email_hash: emailHash,
        },
      },
    });

    if (device) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { device_id: device.id },
      });
    }
  }

  // ==========================================================================
  // Per-Store Credentials Management
  // ==========================================================================

  /**
   * Save Shopify App credentials for a store
   * These are the API Key and Secret from the customer's own Shopify App
   */
  async saveCredentials(storeId: string, apiKey: string, apiSecret: string): Promise<void> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new BadRequestException('Store not found');
    }

    // Debug logging
    this.logger.debug(`[saveCredentials] Input apiKey length: ${apiKey.length}`);
    this.logger.debug(`[saveCredentials] Input apiKey preview: ${apiKey.substring(0, 8)}...`);

    const settings = (store.settings as Record<string, any>) || {};

    const encryptedApiKey = this.encryptToken(apiKey);
    const encryptedApiSecret = this.encryptToken(apiSecret);

    this.logger.debug(`[saveCredentials] Encrypted apiKey: ${encryptedApiKey}`);
    this.logger.debug(`[saveCredentials] Encrypted apiKey length: ${encryptedApiKey.length}`);
    this.logger.debug(`[saveCredentials] Contains colons: ${encryptedApiKey.includes(':')}`);

    // Store encrypted credentials
    settings.shopify_credentials = {
      api_key: encryptedApiKey,
      api_secret: encryptedApiSecret,
      configured_at: new Date().toISOString(),
    };

    await this.prisma.store.update({
      where: { id: storeId },
      data: { settings },
    });

    this.logger.log(`Shopify credentials saved for store ${storeId}`);
  }

  /**
   * Get Shopify credentials status for a store (without exposing secrets)
   */
  async getCredentialsStatus(storeId: string): Promise<{ configured: boolean; api_key_preview?: string }> {
    const credentials = await this.getStoreCredentials(storeId);

    if (!credentials) {
      return { configured: false };
    }

    // Show only first 4 and last 4 characters of API key
    const apiKey = credentials.apiKey;
    const preview = apiKey.length > 8
      ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
      : '****';

    return {
      configured: true,
      api_key_preview: preview,
    };
  }

  /**
   * Get decrypted Shopify credentials for a store
   * Returns null if not configured
   */
  async getStoreCredentials(storeId: string): Promise<{ apiKey: string; apiSecret: string } | null> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { settings: true },
    });

    if (!store) {
      return null;
    }

    const settings = store.settings as Record<string, any>;
    const shopifyCredentials = settings?.shopify_credentials;

    if (!shopifyCredentials?.api_key || !shopifyCredentials?.api_secret) {
      return null;
    }

    // Debug logging
    this.logger.debug(`[getStoreCredentials] Raw api_key from DB: ${shopifyCredentials.api_key}`);
    this.logger.debug(`[getStoreCredentials] Raw api_key length: ${shopifyCredentials.api_key.length}`);
    this.logger.debug(`[getStoreCredentials] Contains colons: ${shopifyCredentials.api_key.includes(':')}`);

    const decryptedApiKey = this.decryptToken(shopifyCredentials.api_key);
    const decryptedApiSecret = this.decryptToken(shopifyCredentials.api_secret);

    this.logger.debug(`[getStoreCredentials] Decrypted api_key: ${decryptedApiKey.substring(0, 8)}...`);
    this.logger.debug(`[getStoreCredentials] Decrypted api_key length: ${decryptedApiKey.length}`);

    return {
      apiKey: decryptedApiKey,
      apiSecret: decryptedApiSecret,
    };
  }
}
