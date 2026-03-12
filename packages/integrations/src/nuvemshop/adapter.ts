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
import type { NuvemshopConfig } from './types.js'
import { NUVEMSHOP_DOMAIN_PATTERN } from './types.js'

export class NuvemshopAdapter implements PlatformAdapter {
  readonly platform = 'nuvemshop' as const

  private readonly config: NuvemshopConfig

  constructor(config: NuvemshopConfig) {
    if (!NUVEMSHOP_DOMAIN_PATTERN.test(config.shopDomain)) {
      throw new Error(
        `Invalid Nuvemshop domain: ${config.shopDomain}. Must match *.nuvemshop.com or *.lojavirtualnuvem.com.br`,
      )
    }
    this.config = config
  }

  getProducts(_params: ProductQuery): Promise<Product[]> {
    throw new Error(`[${this.config.shopDomain}] NuvemshopAdapter.getProducts not implemented`)
  }

  getOrders(_params: OrderQuery): Promise<Order[]> {
    throw new Error(`[${this.config.shopDomain}] NuvemshopAdapter.getOrders not implemented`)
  }

  getAbandonedCarts(): Promise<AbandonedCart[]> {
    throw new Error(
      `[${this.config.shopDomain}] NuvemshopAdapter.getAbandonedCarts not implemented`,
    )
  }

  getCustomer(_id: string): Promise<Customer> {
    throw new Error(`[${this.config.shopDomain}] NuvemshopAdapter.getCustomer not implemented`)
  }

  registerWebhooks(_hooks: WebhookConfig[]): Promise<void> {
    throw new Error(`[${this.config.shopDomain}] NuvemshopAdapter.registerWebhooks not implemented`)
  }
}
