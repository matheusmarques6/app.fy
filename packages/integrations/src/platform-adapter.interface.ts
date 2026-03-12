import type {
  AbandonedCart,
  Customer,
  Order,
  OrderQuery,
  Product,
  ProductQuery,
  WebhookConfig,
} from './types.js'

/**
 * Contract for all e-commerce platform adapters.
 *
 * New platform = new folder implementing this interface.
 * The rest of the system never depends on platform-specific code.
 */
export interface PlatformAdapter {
  /** Unique identifier for the platform (e.g. 'shopify', 'nuvemshop') */
  readonly platform: string

  getProducts(params: ProductQuery): Promise<Product[]>
  getOrders(params: OrderQuery): Promise<Order[]>
  getAbandonedCarts(): Promise<AbandonedCart[]>
  getCustomer(id: string): Promise<Customer>
  registerWebhooks(hooks: WebhookConfig[]): Promise<void>
}

/**
 * Configuration required to initialize a platform adapter.
 * Each adapter may extend this with platform-specific fields.
 */
export interface PlatformAdapterConfig {
  readonly shopDomain: string
  readonly accessToken: string
}
