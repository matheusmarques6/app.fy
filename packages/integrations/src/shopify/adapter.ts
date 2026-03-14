import { FetchHttpClient, type HttpClient } from '../http-client.js'
import type { PlatformAdapter } from '../platform-adapter.interface.js'
import type {
  AbandonedCart,
  Customer,
  LineItem,
  Order,
  OrderQuery,
  OrderStatus,
  Product,
  ProductQuery,
  ProductVariant,
  WebhookConfig,
} from '../types.js'
import type { ShopifyConfig } from './types.js'
import { SHOPIFY_DOMAIN_PATTERN } from './types.js'

// ──────────────────────────────────────────────
// Shopify API response types (internal)
// ──────────────────────────────────────────────

interface ShopifyProduct {
  id: number
  title: string
  handle: string
  image?: { src: string } | null
  variants: ShopifyVariant[]
}

interface ShopifyVariant {
  id: number
  title: string
  price: string
  sku: string | null
}

interface ShopifyOrder {
  id: number
  order_number: number
  total_price: string
  currency: string
  financial_status: string
  line_items: ShopifyLineItem[]
  customer: ShopifyCustomer | null
  created_at: string
}

interface ShopifyLineItem {
  product_id: number
  title: string
  quantity: number
  price: string
}

interface ShopifyCheckout {
  id: number
  token: string
  total_price: string
  abandoned_checkout_url: string
  line_items: ShopifyLineItem[]
  customer: ShopifyCustomer | null
  created_at: string
}

interface ShopifyCustomer {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
}

const DEFAULT_API_VERSION = '2024-01'

export class ShopifyAdapter implements PlatformAdapter {
  readonly platform = 'shopify' as const

  private readonly config: ShopifyConfig
  private readonly httpClient: HttpClient
  private readonly baseUrl: string
  private readonly authHeaders: Record<string, string>

  constructor(config: ShopifyConfig, httpClient?: HttpClient) {
    if (!SHOPIFY_DOMAIN_PATTERN.test(config.shopDomain)) {
      throw new Error(`Invalid Shopify domain: ${config.shopDomain}. Must match *.myshopify.com`)
    }
    this.config = config
    this.httpClient = httpClient ?? new FetchHttpClient()
    const apiVersion = config.apiVersion ?? DEFAULT_API_VERSION
    this.baseUrl = `https://${config.shopDomain}/admin/api/${apiVersion}`
    this.authHeaders = { 'X-Shopify-Access-Token': config.accessToken }
  }

  async getProducts(params: ProductQuery): Promise<Product[]> {
    const queryParts: string[] = []
    if (params.limit) queryParts.push(`limit=${params.limit}`)
    if (params.sinceId) queryParts.push(`since_id=${params.sinceId}`)
    const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''

    const data = await this.httpClient.get<{ products: ShopifyProduct[] }>(
      `${this.baseUrl}/products.json${query}`,
      this.authHeaders,
    )
    return data.products.map((p) => mapShopifyProduct(p, this.config.shopDomain))
  }

  async getOrders(params: OrderQuery): Promise<Order[]> {
    const queryParts: string[] = []
    if (params.limit) queryParts.push(`limit=${params.limit}`)
    if (params.status) queryParts.push(`status=${params.status}`)
    if (params.sinceDate) queryParts.push(`created_at_min=${params.sinceDate.toISOString()}`)
    const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''

    const data = await this.httpClient.get<{ orders: ShopifyOrder[] }>(
      `${this.baseUrl}/orders.json${query}`,
      this.authHeaders,
    )
    return data.orders.map(mapShopifyOrder)
  }

  async getAbandonedCarts(): Promise<AbandonedCart[]> {
    const data = await this.httpClient.get<{ checkouts: ShopifyCheckout[] }>(
      `${this.baseUrl}/checkouts.json?status=open`,
      this.authHeaders,
    )
    return data.checkouts.map(mapShopifyCheckout)
  }

  async getCustomer(id: string): Promise<Customer> {
    const data = await this.httpClient.get<{ customer: ShopifyCustomer }>(
      `${this.baseUrl}/customers/${id}.json`,
      this.authHeaders,
    )
    return mapShopifyCustomer(data.customer)
  }

  async registerWebhooks(hooks: WebhookConfig[]): Promise<void> {
    for (const hook of hooks) {
      await this.httpClient.post(
        `${this.baseUrl}/webhooks.json`,
        {
          webhook: {
            topic: hook.topic,
            address: hook.address,
            format: hook.format ?? 'json',
          },
        },
        this.authHeaders,
      )
    }
  }
}

// ──────────────────────────────────────────────
// Mapping helpers
// ──────────────────────────────────────────────

function mapShopifyProduct(p: ShopifyProduct, shopDomain: string): Product {
  return {
    id: String(p.id),
    title: p.title,
    price: p.variants[0] ? Number.parseFloat(p.variants[0].price) : 0,
    imageUrl: p.image?.src ?? null,
    url: `https://${shopDomain}/products/${p.handle}`,
    variants: p.variants.map(mapShopifyVariant),
  }
}

function mapShopifyVariant(v: ShopifyVariant): ProductVariant {
  return {
    id: String(v.id),
    title: v.title,
    price: Number.parseFloat(v.price),
    sku: v.sku,
  }
}

function mapShopifyOrder(o: ShopifyOrder): Order {
  return {
    id: String(o.id),
    orderNumber: String(o.order_number),
    totalPrice: Number.parseFloat(o.total_price),
    currency: o.currency,
    lineItems: o.line_items.map(mapShopifyLineItem),
    customer: o.customer ? mapShopifyCustomer(o.customer) : { id: '', email: '', name: null, phone: null },
    status: mapShopifyFinancialStatus(o.financial_status),
    createdAt: new Date(o.created_at),
  }
}

function mapShopifyLineItem(li: ShopifyLineItem): LineItem {
  return {
    productId: String(li.product_id),
    title: li.title,
    quantity: li.quantity,
    price: Number.parseFloat(li.price),
  }
}

function mapShopifyCheckout(c: ShopifyCheckout): AbandonedCart {
  return {
    id: String(c.id),
    lineItems: c.line_items.map(mapShopifyLineItem),
    totalPrice: Number.parseFloat(c.total_price),
    customer: c.customer ? mapShopifyCustomer(c.customer) : { id: '', email: '', name: null, phone: null },
    createdAt: new Date(c.created_at),
    checkoutUrl: c.abandoned_checkout_url,
  }
}

function mapShopifyCustomer(c: ShopifyCustomer): Customer {
  const firstName = c.first_name ?? ''
  const lastName = c.last_name ?? ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || null

  return {
    id: String(c.id),
    email: c.email,
    name: fullName,
    phone: c.phone,
  }
}

function mapShopifyFinancialStatus(status: string): OrderStatus {
  const statusMap: Record<string, OrderStatus> = {
    pending: 'pending',
    paid: 'paid',
    voided: 'cancelled',
    refunded: 'refunded',
    partially_refunded: 'refunded',
  }
  return statusMap[status] ?? 'pending'
}
