import type { PlatformAdapter } from '../platform-adapter.interface.js'
import type {
  AbandonedCart,
  Customer,
  Order,
  OrderQuery,
  Product,
  ProductQuery,
  WebhookConfig,
} from '../types.js'
import type { ShopifyConfig } from './types.js'
import { SHOPIFY_DOMAIN_PATTERN } from './types.js'

export class ShopifyAdapter implements PlatformAdapter {
  readonly platform = 'shopify' as const

  private readonly config: ShopifyConfig

  constructor(config: ShopifyConfig) {
    if (!SHOPIFY_DOMAIN_PATTERN.test(config.shopDomain)) {
      throw new Error(`Invalid Shopify domain: ${config.shopDomain}. Must match *.myshopify.com`)
    }
    this.config = config
  }

  getProducts(_params: ProductQuery): Promise<Product[]> {
    throw new Error(`[${this.config.shopDomain}] ShopifyAdapter.getProducts not implemented`)
  }

  getOrders(_params: OrderQuery): Promise<Order[]> {
    throw new Error(`[${this.config.shopDomain}] ShopifyAdapter.getOrders not implemented`)
  }

  getAbandonedCarts(): Promise<AbandonedCart[]> {
    throw new Error(`[${this.config.shopDomain}] ShopifyAdapter.getAbandonedCarts not implemented`)
  }

  getCustomer(_id: string): Promise<Customer> {
    throw new Error(`[${this.config.shopDomain}] ShopifyAdapter.getCustomer not implemented`)
  }

  registerWebhooks(_hooks: WebhookConfig[]): Promise<void> {
    throw new Error(`[${this.config.shopDomain}] ShopifyAdapter.registerWebhooks not implemented`)
  }
}
