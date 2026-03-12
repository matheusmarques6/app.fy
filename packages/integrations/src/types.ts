// ──────────────────────────────────────────────
// Normalized platform-agnostic types
// Adapters convert platform-specific data into these
// ──────────────────────────────────────────────

export interface Product {
  readonly id: string
  readonly title: string
  readonly price: number
  readonly imageUrl: string | null
  readonly url: string
  readonly variants: ProductVariant[]
}

export interface ProductVariant {
  readonly id: string
  readonly title: string
  readonly price: number
  readonly sku: string | null
}

export interface Order {
  readonly id: string
  readonly orderNumber: string
  readonly totalPrice: number
  readonly currency: string
  readonly lineItems: LineItem[]
  readonly customer: Customer
  readonly status: OrderStatus
  readonly createdAt: Date
}

export type OrderStatus = 'pending' | 'paid' | 'cancelled' | 'fulfilled' | 'refunded'

export interface LineItem {
  readonly productId: string
  readonly title: string
  readonly quantity: number
  readonly price: number
}

export interface AbandonedCart {
  readonly id: string
  readonly lineItems: LineItem[]
  readonly totalPrice: number
  readonly customer: Customer
  readonly createdAt: Date
  readonly checkoutUrl: string
}

export interface Customer {
  readonly id: string
  readonly email: string
  /** Nullable because platforms don't always provide customer name */
  readonly name: string | null
  /** Nullable because platforms don't always provide customer phone */
  readonly phone: string | null
}

// ──────────────────────────────────────────────
// Query parameters
// ──────────────────────────────────────────────

export interface ProductQuery {
  readonly limit?: number
  readonly cursor?: string
  readonly sinceId?: string
}

export interface OrderQuery {
  readonly limit?: number
  readonly cursor?: string
  readonly status?: OrderStatus
  readonly sinceDate?: Date
}

// ──────────────────────────────────────────────
// Webhook types
// ──────────────────────────────────────────────

export interface WebhookConfig {
  readonly topic: string
  readonly address: string
  readonly format?: 'json' | 'xml'
}

export interface WebhookPayload {
  readonly topic: string
  readonly shopDomain: string
  readonly data: unknown
  readonly hmac: string
}
