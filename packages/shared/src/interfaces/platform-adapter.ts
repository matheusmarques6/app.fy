/** Product from an e-commerce platform */
export interface PlatformProduct {
  readonly externalId: string
  readonly title: string
  readonly price: number
  readonly currency: string
  readonly imageUrl: string | null
  readonly url: string | null
}

/** Order from an e-commerce platform */
export interface PlatformOrder {
  readonly externalId: string
  readonly customerEmail: string | null
  readonly totalPrice: number
  readonly currency: string
  readonly status: string
  readonly createdAt: Date
}

/** Abandoned cart from an e-commerce platform */
export interface PlatformAbandonedCart {
  readonly externalId: string
  readonly customerEmail: string | null
  readonly totalPrice: number
  readonly currency: string
  readonly items: readonly PlatformCartItem[]
  readonly createdAt: Date
}

/** Cart item */
export interface PlatformCartItem {
  readonly productId: string
  readonly title: string
  readonly quantity: number
  readonly price: number
}

/** Customer from an e-commerce platform */
export interface PlatformCustomer {
  readonly externalId: string
  readonly email: string
  readonly name: string | null
  readonly totalOrders: number
  readonly totalSpent: number
}

/** Webhook registration result */
export interface WebhookRegistration {
  readonly webhookId: string
  readonly topic: string
  readonly address: string
}

/**
 * Adapter contract for e-commerce platforms (Shopify, Nuvemshop).
 * Each platform implements this interface.
 */
export interface PlatformAdapter {
  getProducts(page?: number, perPage?: number): Promise<readonly PlatformProduct[]>
  getOrders(page?: number, perPage?: number): Promise<readonly PlatformOrder[]>
  getAbandonedCarts(): Promise<readonly PlatformAbandonedCart[]>
  getCustomer(externalId: string): Promise<PlatformCustomer | null>
  registerWebhooks(callbackUrl: string, topics: readonly string[]): Promise<readonly WebhookRegistration[]>
}
