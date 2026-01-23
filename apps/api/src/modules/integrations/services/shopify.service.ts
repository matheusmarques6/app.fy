import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  ShopifyOAuthCallbackDto,
  ShopifyProductDto,
  ShopifyOrderDto,
  ShopifyCustomerDto,
} from '../dto/shopify.dto';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ==========================================================================
  // OAuth Flow
  // ==========================================================================

  /**
   * Generate Shopify OAuth install URL
   */
  generateInstallUrl(storeId: string, shop: string): { installUrl: string; state: string } {
    const apiKey = this.config.get<string>('SHOPIFY_API_KEY');
    const redirectUri = this.config.get<string>('SHOPIFY_REDIRECT_URI');

    if (!apiKey || !redirectUri) {
      throw new BadRequestException('Shopify integration not configured');
    }

    // Normalize shop domain
    const normalizedShop = this.normalizeShopDomain(shop);

    // Generate state (includes storeId for callback)
    const nonce = randomBytes(16).toString('hex');
    const state = Buffer.from(JSON.stringify({ storeId, nonce })).toString('base64');

    const installUrl = `https://${normalizedShop}/admin/oauth/authorize?` +
      `client_id=${apiKey}&` +
      `scope=${this.scopes.join(',')}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${state}`;

    return { installUrl, state };
  }

  /**
   * Handle OAuth callback and exchange code for access token
   */
  async handleOAuthCallback(dto: ShopifyOAuthCallbackDto): Promise<{ integrationId: string }> {
    const { code, shop, state, hmac, timestamp } = dto;

    // Validate HMAC
    if (hmac) {
      this.validateHmac({ code, shop, state, timestamp }, hmac);
    }

    // Decode state
    let storeId: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
      storeId = decoded.storeId;
    } catch (e) {
      throw new BadRequestException('Invalid state parameter');
    }

    // Exchange code for access token
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
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(shop: string, code: string): Promise<string> {
    const apiKey = this.config.get<string>('SHOPIFY_API_KEY');
    const apiSecret = this.config.get<string>('SHOPIFY_API_SECRET');

    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
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
   */
  async registerWebhooks(integrationId: string, shop: string, accessToken: string): Promise<void> {
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

        this.logger.log(`Registered webhook: ${topic} for integration ${integrationId}`);
      } catch (error) {
        this.logger.error(`Failed to register webhook ${topic}:`, error);
      }
    }
  }

  /**
   * Validate webhook HMAC signature
   */
  validateWebhookSignature(body: string, hmacHeader: string): boolean {
    const apiSecret = this.config.get<string>('SHOPIFY_API_SECRET');
    if (!apiSecret) return false;

    const hash = createHmac('sha256', apiSecret)
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
        status: action === 'paid' ? 'paid' : action === 'cancelled' ? 'cancelled' : undefined,
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

    // If order is paid, trigger attribution calculation
    if (action === 'paid') {
      // TODO: Queue attribution calculation job
      // This will look at recent push deliveries and attribute the order
      this.logger.log(`Order ${order.id} paid - triggering attribution`);
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
   * Handle app uninstall
   */
  private async handleUninstall(integrationId: string): Promise<void> {
    this.logger.log(`App uninstalled for integration ${integrationId}`);

    await this.prisma.integration.update({
      where: { id: integrationId },
      data: {
        status: 'disconnected',
        access_token_ref: null,
        refresh_token_ref: null,
      },
    });
  }

  // ==========================================================================
  // API Methods
  // ==========================================================================

  /**
   * Make Shopify API request
   */
  private async shopifyApiRequest(
    shop: string,
    accessToken: string,
    method: string,
    endpoint: string,
    body?: any,
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

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Shopify API error: ${response.status} ${error}`);
      throw new Error(`Shopify API error: ${response.status}`);
    }

    return response.json();
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
    const apiSecret = this.config.get<string>('SHOPIFY_API_SECRET');
    if (!apiSecret) {
      throw new BadRequestException('Shopify not configured');
    }

    // Build query string (sorted, without hmac)
    const entries = Object.entries(params)
      .filter(([key, value]) => key !== 'hmac' && value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));

    const message = entries.map(([key, value]) => `${key}=${value}`).join('&');

    const hash = createHmac('sha256', apiSecret)
      .update(message)
      .digest('hex');

    if (hash !== hmac) {
      throw new UnauthorizedException('Invalid HMAC');
    }
  }

  private hashEmail(email: string): string {
    return createHmac('sha256', 'email-hash-salt')
      .update(email.toLowerCase().trim())
      .digest('hex');
  }

  // In production, use KMS/Vault
  private encryptToken(token: string): string {
    // Simple base64 for now - use proper encryption in production
    return Buffer.from(token).toString('base64');
  }

  private decryptToken(encrypted: string): string {
    return Buffer.from(encrypted, 'base64').toString();
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
}
