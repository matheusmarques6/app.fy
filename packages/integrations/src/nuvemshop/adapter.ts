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
import type { NuvemshopConfig } from './types.js'
import { NUVEMSHOP_DOMAIN_PATTERN } from './types.js'

// ──────────────────────────────────────────────
// Nuvemshop API response types (internal)
// ──────────────────────────────────────────────

interface NuvemshopProduct {
  id: number
  name: { pt: string } | string
  handle: { pt: string } | string
  images: Array<{ src: string }> | []
  variants: NuvemshopVariant[]
}

interface NuvemshopVariant {
  id: number
  name: string | null
  price: string
  sku: string | null
}

interface NuvemshopOrder {
  id: number
  number: string
  total: string
  currency: string
  payment_status: string
  products: NuvemshopOrderProduct[]
  customer: NuvemshopCustomer | null
  created_at: string
}

interface NuvemshopOrderProduct {
  product_id: number
  name: string
  quantity: number
  price: string
}

interface NuvemshopCheckout {
  id: number
  token: string
  total: string
  checkout_url: string
  products: NuvemshopOrderProduct[]
  customer: NuvemshopCustomer | null
  created_at: string
}

interface NuvemshopCustomer {
  id: number
  email: string
  name: string | null
  phone: string | null
}

export class NuvemshopAdapter implements PlatformAdapter {
  readonly platform = 'nuvemshop' as const

  private readonly config: NuvemshopConfig
  private readonly httpClient: HttpClient
  private readonly baseUrl: string
  private readonly authHeaders: Record<string, string>
  private readonly storeId: string

  constructor(config: NuvemshopConfig, httpClient?: HttpClient) {
    if (!NUVEMSHOP_DOMAIN_PATTERN.test(config.shopDomain)) {
      throw new Error(
        `Invalid Nuvemshop domain: ${config.shopDomain}. Must match *.nuvemshop.com or *.lojavirtualnuvem.com.br`,
      )
    }
    this.config = config
    this.httpClient = httpClient ?? new FetchHttpClient()
    this.storeId = extractStoreId(config.shopDomain)
    this.baseUrl = `https://api.nuvemshop.com.br/v1/${this.storeId}`
    this.authHeaders = {
      Authentication: `bearer ${config.accessToken}`,
      'User-Agent': 'AppFy/1.0',
    }
  }

  async getProducts(params: ProductQuery): Promise<Product[]> {
    const queryParts: string[] = []
    if (params.limit) queryParts.push(`per_page=${params.limit}`)
    if (params.sinceId) queryParts.push(`since_id=${params.sinceId}`)
    const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''

    const products = await this.httpClient.get<NuvemshopProduct[]>(
      `${this.baseUrl}/products${query}`,
      this.authHeaders,
    )
    return products.map((p) => mapNuvemshopProduct(p, this.config.shopDomain))
  }

  async getOrders(params: OrderQuery): Promise<Order[]> {
    const queryParts: string[] = []
    if (params.limit) queryParts.push(`per_page=${params.limit}`)
    if (params.status) queryParts.push(`payment_status=${mapOrderStatusToNuvemshop(params.status)}`)
    if (params.sinceDate) queryParts.push(`created_at_min=${params.sinceDate.toISOString()}`)
    const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''

    const orders = await this.httpClient.get<NuvemshopOrder[]>(
      `${this.baseUrl}/orders${query}`,
      this.authHeaders,
    )
    return orders.map(mapNuvemshopOrder)
  }

  async getAbandonedCarts(): Promise<AbandonedCart[]> {
    const checkouts = await this.httpClient.get<NuvemshopCheckout[]>(
      `${this.baseUrl}/checkouts?status=open`,
      this.authHeaders,
    )
    return checkouts.map(mapNuvemshopCheckout)
  }

  async getCustomer(id: string): Promise<Customer> {
    const customer = await this.httpClient.get<NuvemshopCustomer>(
      `${this.baseUrl}/customers/${id}`,
      this.authHeaders,
    )
    return mapNuvemshopCustomer(customer)
  }

  async registerWebhooks(hooks: WebhookConfig[]): Promise<void> {
    for (const hook of hooks) {
      await this.httpClient.post(
        `${this.baseUrl}/webhooks`,
        {
          event: hook.topic,
          url: hook.address,
        },
        this.authHeaders,
      )
    }
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function extractStoreId(domain: string): string {
  // Domain format: storename.nuvemshop.com or storename.lojavirtualnuvem.com.br
  const parts = domain.split('.')
  if (!parts[0]) throw new Error(`Cannot extract store ID from domain: ${domain}`)
  return parts[0]
}

function resolveLocalizedField(field: { pt: string } | string): string {
  if (typeof field === 'string') return field
  return field.pt
}

function mapNuvemshopProduct(p: NuvemshopProduct, shopDomain: string): Product {
  const name = resolveLocalizedField(p.name)
  const handle = resolveLocalizedField(p.handle)

  return {
    id: String(p.id),
    title: name,
    price: p.variants[0] ? Number.parseFloat(p.variants[0].price) : 0,
    imageUrl: p.images[0]?.src ?? null,
    url: `https://${shopDomain}/produtos/${handle}`,
    variants: p.variants.map(mapNuvemshopVariant),
  }
}

function mapNuvemshopVariant(v: NuvemshopVariant): ProductVariant {
  return {
    id: String(v.id),
    title: v.name ?? 'Default',
    price: Number.parseFloat(v.price),
    sku: v.sku,
  }
}

function mapNuvemshopOrder(o: NuvemshopOrder): Order {
  return {
    id: String(o.id),
    orderNumber: String(o.number),
    totalPrice: Number.parseFloat(o.total),
    currency: o.currency,
    lineItems: o.products.map(mapNuvemshopLineItem),
    customer: o.customer ? mapNuvemshopCustomer(o.customer) : { id: '', email: '', name: null, phone: null },
    status: mapNuvemshopPaymentStatus(o.payment_status),
    createdAt: new Date(o.created_at),
  }
}

function mapNuvemshopLineItem(p: NuvemshopOrderProduct): LineItem {
  return {
    productId: String(p.product_id),
    title: p.name,
    quantity: p.quantity,
    price: Number.parseFloat(p.price),
  }
}

function mapNuvemshopCheckout(c: NuvemshopCheckout): AbandonedCart {
  return {
    id: String(c.id),
    lineItems: c.products.map(mapNuvemshopLineItem),
    totalPrice: Number.parseFloat(c.total),
    customer: c.customer ? mapNuvemshopCustomer(c.customer) : { id: '', email: '', name: null, phone: null },
    createdAt: new Date(c.created_at),
    checkoutUrl: c.checkout_url,
  }
}

function mapNuvemshopCustomer(c: NuvemshopCustomer): Customer {
  return {
    id: String(c.id),
    email: c.email,
    name: c.name,
    phone: c.phone,
  }
}

function mapOrderStatusToNuvemshop(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    pending: 'pending',
    paid: 'paid',
    cancelled: 'voided',
    fulfilled: 'paid',
    refunded: 'refunded',
  }
  return map[status]
}

function mapNuvemshopPaymentStatus(status: string): OrderStatus {
  const statusMap: Record<string, OrderStatus> = {
    pending: 'pending',
    paid: 'paid',
    voided: 'cancelled',
    refunded: 'refunded',
  }
  return statusMap[status] ?? 'pending'
}
