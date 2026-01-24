import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHmac, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual, scryptSync } from 'crypto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { QUEUE_NAMES } from '@appfy/shared';
import {
  WooCommerceConnectDto,
  WooCommerceProductDto,
  WooCommerceOrderDto,
  WooCommerceCustomerDto,
} from '../dto/woocommerce.dto';

// Rate limit retry config
const MAX_API_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
// Encryption algorithm
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

@Injectable()
export class WooCommerceService {
  private readonly logger = new Logger(WooCommerceService.name);
  private readonly apiVersion = 'wc/v3';
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
  // Connection
  // ==========================================================================

  /**
   * Connect WooCommerce store using API keys
   */
  async connect(storeId: string, dto: WooCommerceConnectDto): Promise<{ integrationId: string }> {
    const { store_url, consumer_key, consumer_secret } = dto;

    // Normalize URL
    const normalizedUrl = this.normalizeStoreUrl(store_url);

    // Test connection
    const shopInfo = await this.testConnection(normalizedUrl, consumer_key, consumer_secret);

    // Save integration
    const integration = await this.prisma.integration.upsert({
      where: {
        store_id_platform: {
          store_id: storeId,
          platform: 'woocommerce',
        },
      },
      create: {
        store_id: storeId,
        platform: 'woocommerce',
        status: 'active',
        shop_domain: normalizedUrl,
        access_token_ref: this.encryptCredentials(consumer_key, consumer_secret),
        scopes: ['read', 'write'],
        metadata: {
          store_name: shopInfo.name,
          store_url: shopInfo.URL,
          wc_version: shopInfo.wc_version,
          currency: shopInfo.currency,
          currency_symbol: shopInfo.currency_symbol,
        },
      },
      update: {
        status: 'active',
        shop_domain: normalizedUrl,
        access_token_ref: this.encryptCredentials(consumer_key, consumer_secret),
        metadata: {
          store_name: shopInfo.name,
          store_url: shopInfo.URL,
          wc_version: shopInfo.wc_version,
          currency: shopInfo.currency,
          currency_symbol: shopInfo.currency_symbol,
        },
        updated_at: new Date(),
      },
    });

    // Register webhooks
    await this.registerWebhooks(integration.id, normalizedUrl, consumer_key, consumer_secret);

    return { integrationId: integration.id };
  }

  /**
   * Test WooCommerce connection
   */
  private async testConnection(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string,
  ): Promise<any> {
    try {
      const response = await this.wooApiRequest(storeUrl, consumerKey, consumerSecret, 'GET', '');
      return response;
    } catch (error) {
      this.logger.error('WooCommerce connection test failed', error);
      throw new BadRequestException('Failed to connect to WooCommerce store. Please check your credentials.');
    }
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
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string,
  ): Promise<{ registered: string[]; failed: string[] }> {
    const webhookBaseUrl = this.config.get<string>('WEBHOOK_BASE_URL');

    const topics = [
      { name: 'order.created', topic: 'order.created' },
      { name: 'order.updated', topic: 'order.updated' },
      { name: 'product.created', topic: 'product.created' },
      { name: 'product.updated', topic: 'product.updated' },
      { name: 'product.deleted', topic: 'product.deleted' },
      { name: 'customer.created', topic: 'customer.created' },
      { name: 'customer.updated', topic: 'customer.updated' },
    ];

    const registered: string[] = [];
    const failed: string[] = [];

    for (const { name, topic } of topics) {
      try {
        const deliveryUrl = `${webhookBaseUrl}/v1/integrations/woocommerce/webhooks/${integrationId}`;

        const response = await this.wooApiRequest(
          storeUrl,
          consumerKey,
          consumerSecret,
          'POST',
          '/webhooks',
          {
            name: `AppFy - ${name}`,
            topic,
            delivery_url: deliveryUrl,
            status: 'active',
          },
        );

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
            webhook_id: response.id?.toString(),
            address: deliveryUrl,
            status: 'active',
          },
          update: {
            webhook_id: response.id?.toString(),
            address: deliveryUrl,
            status: 'active',
          },
        });

        registered.push(topic);
        this.logger.log(`Registered WooCommerce webhook: ${topic} for integration ${integrationId}`);
      } catch (error) {
        failed.push(topic);
        this.logger.error(`Failed to register WooCommerce webhook ${topic}:`, error);

        // Track failed webhook in database
        const deliveryUrl = `${webhookBaseUrl}/v1/integrations/woocommerce/webhooks/${integrationId}`;
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
            address: deliveryUrl,
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
      `WooCommerce webhook registration complete for ${integrationId}: ${registered.length} registered, ${failed.length} failed`,
    );

    return { registered, failed };
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(body: string, signature: string, secret: string): boolean {
    const hash = createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64');

    try {
      return timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
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
    payload: any,
  ): Promise<void> {
    this.logger.log(`Processing WooCommerce webhook: ${topic}`);

    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
      include: { store: true },
    });

    if (!integration) {
      throw new UnauthorizedException('Invalid integration');
    }

    switch (topic) {
      case 'order.created':
      case 'order.updated':
        await this.handleOrderWebhook(integration.store_id, payload as WooCommerceOrderDto);
        break;

      case 'product.created':
      case 'product.updated':
        await this.handleProductWebhook(integration.store_id, payload as WooCommerceProductDto, 'upsert');
        break;

      case 'product.deleted':
        await this.handleProductWebhook(integration.store_id, payload as WooCommerceProductDto, 'delete');
        break;

      case 'customer.created':
      case 'customer.updated':
        await this.handleCustomerWebhook(integration.store_id, payload as WooCommerceCustomerDto);
        break;

      default:
        this.logger.warn(`Unhandled WooCommerce webhook topic: ${topic}`);
    }
  }

  // ==========================================================================
  // Webhook Handlers
  // ==========================================================================

  /**
   * Handle order webhook
   */
  private async handleOrderWebhook(
    storeId: string,
    order: WooCommerceOrderDto,
  ): Promise<void> {
    this.logger.log(`Processing WooCommerce order ${order.id} for store ${storeId}`);

    // Map WooCommerce status to our status
    const statusMap: Record<string, string> = {
      'pending': 'created',
      'processing': 'created',
      'on-hold': 'created',
      'completed': 'paid',
      'cancelled': 'cancelled',
      'refunded': 'refunded',
      'failed': 'cancelled',
    };

    const status = statusMap[order.status] || 'created';
    const isPaid = ['completed', 'processing'].includes(order.status);

    // Convert price to minor units
    const totalAmountMinor = Math.round(parseFloat(order.total) * 100);
    const subtotalAmountMinor = Math.round(parseFloat(order.subtotal) * 100);

    // Get email from billing
    const email = order.billing?.email;

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
        order_number: order.number,
        external_customer_id: order.customer_id?.toString(),
        email_hash: email ? this.hashEmail(email) : null,
        status,
        source: 'webhook',
        total_amount_minor: totalAmountMinor,
        subtotal_amount_minor: subtotalAmountMinor,
        currency: order.currency,
        items_count: order.line_items.length,
        metadata: {
          wc_status: order.status,
          payment_method: order.payment_method,
          payment_method_title: order.payment_method_title,
          line_items: order.line_items.map(item => ({
            product_id: item.product_id,
            variation_id: item.variation_id,
            name: item.name,
            quantity: item.quantity,
            price_minor: Math.round(item.price * 100),
          })),
          coupon_lines: order.coupon_lines,
          date_paid: order.date_paid,
        },
      },
      update: {
        status,
        source: 'merged',
        total_amount_minor: totalAmountMinor,
        subtotal_amount_minor: subtotalAmountMinor,
        metadata: {
          wc_status: order.status,
          payment_method: order.payment_method,
          payment_method_title: order.payment_method_title,
          line_items: order.line_items.map(item => ({
            product_id: item.product_id,
            variation_id: item.variation_id,
            name: item.name,
            quantity: item.quantity,
            price_minor: Math.round(item.price * 100),
          })),
          coupon_lines: order.coupon_lines,
          date_paid: order.date_paid,
        },
        updated_at: new Date(),
      },
    });

    // If paid, queue attribution calculation
    if (isPaid) {
      await this.integrationsQueue.add('attribution-calculation', {
        storeId,
        orderId: dbOrder.id,
        platform: 'woocommerce',
      });
      this.logger.log(`WooCommerce order ${order.id} paid - queued attribution calculation`);
    }

    // Link to device if we can
    if (email) {
      await this.linkOrderToDevice(storeId, dbOrder.id, email);
    }
  }

  /**
   * Handle product webhook
   */
  private async handleProductWebhook(
    storeId: string,
    product: WooCommerceProductDto,
    action: 'upsert' | 'delete',
  ): Promise<void> {
    this.logger.log(`Processing WooCommerce product ${product.id} (${action}) for store ${storeId}`);
    // TODO: Implement product sync
  }

  /**
   * Handle customer webhook
   */
  private async handleCustomerWebhook(
    storeId: string,
    customer: WooCommerceCustomerDto,
  ): Promise<void> {
    this.logger.log(`Processing WooCommerce customer ${customer.id} for store ${storeId}`);

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
          phone_encrypted: customer.billing?.phone ? this.encryptPii(customer.billing.phone) : null,
          name_encrypted: fullName ? this.encryptPii(fullName) : null,
          metadata: {
            orders_count: customer.orders_count,
            total_spent: customer.total_spent,
            is_paying_customer: customer.is_paying_customer,
          },
        },
        update: {
          email_encrypted: this.encryptPii(customer.email),
          phone_encrypted: customer.billing?.phone ? this.encryptPii(customer.billing.phone) : null,
          name_encrypted: fullName ? this.encryptPii(fullName) : null,
          metadata: {
            orders_count: customer.orders_count,
            total_spent: customer.total_spent,
            is_paying_customer: customer.is_paying_customer,
          },
          updated_at: new Date(),
        },
      });
    }
  }

  // ==========================================================================
  // API Methods
  // ==========================================================================

  /**
   * Make WooCommerce API request
   */
  private async wooApiRequest(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string,
    method: string,
    endpoint: string,
    body?: any,
  ): Promise<any> {
    const url = new URL(`/wp-json/${this.apiVersion}${endpoint}`, storeUrl);

    // Use Basic Auth
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    return this.makeRequestWithRetry(url.toString(), method, auth, body);
  }

  /**
   * Make HTTP request with exponential backoff for rate limiting
   */
  private async makeRequestWithRetry(
    url: string,
    method: string,
    auth: string,
    body?: any,
    retryCount = 0,
  ): Promise<any> {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle rate limiting (429) and server errors (5xx) with exponential backoff
    if ((response.status === 429 || response.status >= 500) && retryCount < MAX_API_RETRIES) {
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
      const retryAfter = response.headers.get('Retry-After');
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoffMs;

      this.logger.warn(`WooCommerce API rate limited (${response.status}), retrying in ${waitMs}ms (attempt ${retryCount + 1}/${MAX_API_RETRIES})`);

      await this.sleep(waitMs);
      return this.makeRequestWithRetry(url, method, auth, body, retryCount + 1);
    }

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`WooCommerce API error: ${response.status} ${error}`);
      throw new Error(`WooCommerce API error: ${response.status}`);
    }

    return response.json();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private normalizeStoreUrl(url: string): string {
    let normalized = url.trim();

    // Add https if no protocol
    if (!normalized.startsWith('http')) {
      normalized = `https://${normalized}`;
    }

    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');

    return normalized;
  }

  private hashEmail(email: string): string {
    const salt = this.config.get<string>('EMAIL_HASH_SALT') || 'email-hash-salt';
    return createHmac('sha256', salt)
      .update(email.toLowerCase().trim())
      .digest('hex');
  }

  /**
   * Encrypt credentials using AES-256-GCM
   * Format: iv:authTag:encryptedData (all base64)
   */
  private encryptCredentials(key: string, secret: string): string {
    const data = JSON.stringify({ key, secret });
    const iv = randomBytes(16);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);

    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  /**
   * Decrypt credentials using AES-256-GCM
   */
  private decryptCredentials(encrypted: string): { key: string; secret: string } {
    const parts = encrypted.split(':');

    // Fallback for legacy base64-only format
    if (parts.length === 1) {
      return JSON.parse(Buffer.from(encrypted, 'base64').toString());
    }

    const [ivB64, authTagB64, data] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  /**
   * Encrypt PII using AES-256-GCM
   */
  private encryptPii(value: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);

    let encrypted = cipher.update(value, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  private async linkOrderToDevice(storeId: string, orderId: string, email: string): Promise<void> {
    const emailHash = this.hashEmail(email);

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
