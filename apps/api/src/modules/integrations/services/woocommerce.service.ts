import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  WooCommerceConnectDto,
  WooCommerceProductDto,
  WooCommerceOrderDto,
  WooCommerceCustomerDto,
} from '../dto/woocommerce.dto';

@Injectable()
export class WooCommerceService {
  private readonly logger = new Logger(WooCommerceService.name);
  private readonly apiVersion = 'wc/v3';

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

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
   */
  async registerWebhooks(
    integrationId: string,
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string,
  ): Promise<void> {
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

        this.logger.log(`Registered WooCommerce webhook: ${topic} for integration ${integrationId}`);
      } catch (error) {
        this.logger.error(`Failed to register WooCommerce webhook ${topic}:`, error);
      }
    }
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

    // If paid, trigger attribution
    if (isPaid) {
      this.logger.log(`WooCommerce order ${order.id} paid - triggering attribution`);
      // TODO: Queue attribution calculation
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

    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`WooCommerce API error: ${response.status} ${error}`);
      throw new Error(`WooCommerce API error: ${response.status}`);
    }

    return response.json();
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
    return createHmac('sha256', 'email-hash-salt')
      .update(email.toLowerCase().trim())
      .digest('hex');
  }

  private encryptCredentials(key: string, secret: string): string {
    // Simple encoding for now - use proper encryption in production
    return Buffer.from(JSON.stringify({ key, secret })).toString('base64');
  }

  private decryptCredentials(encrypted: string): { key: string; secret: string } {
    return JSON.parse(Buffer.from(encrypted, 'base64').toString());
  }

  private encryptPii(value: string): string {
    return Buffer.from(value).toString('base64');
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
