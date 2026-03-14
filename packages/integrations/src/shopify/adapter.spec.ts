import { beforeEach, describe, expect, it } from 'vitest'
import type { HttpClient } from '../http-client.js'
import { ShopifyAdapter } from './adapter.js'
import type { ShopifyConfig } from './types.js'

// ──────────────────────────────────────────────
// HttpClient Spy
// ──────────────────────────────────────────────

interface HttpCall {
  method: 'get' | 'post' | 'delete'
  url: string
  body?: unknown | undefined
  headers?: Record<string, string> | undefined
}

class HttpClientSpy implements HttpClient {
  calls: HttpCall[] = []
  getResult: unknown = {}
  postResult: unknown = {}

  call(index: number): HttpCall {
    const c = this.calls[index]
    if (!c) throw new Error(`No call at index ${index}`)
    return c
  }

  async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    this.calls.push({ method: 'get', url, headers })
    return this.getResult as T
  }

  async post<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T> {
    this.calls.push({ method: 'post', url, body, headers })
    return this.postResult as T
  }

  async delete(url: string, headers?: Record<string, string>): Promise<void> {
    this.calls.push({ method: 'delete', url, headers })
  }
}

// ──────────────────────────────────────────────
// Test data factories
// ──────────────────────────────────────────────

const defaultConfig: ShopifyConfig = {
  shopDomain: 'test-store.myshopify.com',
  accessToken: 'shpat_test_token',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
}

function makeShopifyProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 123,
    title: 'Cool T-Shirt',
    handle: 'cool-t-shirt',
    image: { src: 'https://cdn.shopify.com/image.png' },
    variants: [
      { id: 1001, title: 'Small', price: '29.99', sku: 'TSH-S' },
      { id: 1002, title: 'Large', price: '34.99', sku: null },
    ],
    ...overrides,
  }
}

function makeShopifyOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 456,
    order_number: 1001,
    total_price: '99.99',
    currency: 'BRL',
    financial_status: 'paid',
    line_items: [{ product_id: 123, title: 'Cool T-Shirt', quantity: 2, price: '29.99' }],
    customer: { id: 789, email: 'customer@test.com', first_name: 'John', last_name: 'Doe', phone: '+5511999' },
    created_at: '2024-01-15T10:00:00Z',
    ...overrides,
  }
}

function makeShopifyCheckout(overrides: Record<string, unknown> = {}) {
  return {
    id: 555,
    token: 'abc123',
    total_price: '49.99',
    abandoned_checkout_url: 'https://test-store.myshopify.com/checkouts/abc123/recover',
    line_items: [{ product_id: 123, title: 'Cool T-Shirt', quantity: 1, price: '29.99' }],
    customer: { id: 789, email: 'customer@test.com', first_name: 'Jane', last_name: null, phone: null },
    created_at: '2024-01-15T10:00:00Z',
    ...overrides,
  }
}

function makeShopifyCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 789,
    email: 'customer@test.com',
    first_name: 'John',
    last_name: 'Doe',
    phone: '+5511999',
    ...overrides,
  }
}

// ──────────────────────────────────────────────
// makeSut
// ──────────────────────────────────────────────

function makeSut(configOverrides: Partial<ShopifyConfig> = {}) {
  const httpClient = new HttpClientSpy()
  const config = { ...defaultConfig, ...configOverrides }
  const sut = new ShopifyAdapter(config, httpClient)
  return { sut, httpClient }
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('ShopifyAdapter', () => {
  describe('constructor', () => {
    it('should reject invalid Shopify domains', () => {
      expect(() => makeSut({ shopDomain: 'evil.example.com' })).toThrow(/Invalid Shopify domain/)
    })

    it('should reject subdomain spoofing', () => {
      expect(() => makeSut({ shopDomain: 'myshopify.com.evil.com' })).toThrow(/Invalid Shopify domain/)
    })

    it('should accept valid Shopify domains', () => {
      const { sut } = makeSut()
      expect(sut.platform).toBe('shopify')
    })
  })

  describe('getProducts', () => {
    let sut: ShopifyAdapter
    let httpClient: HttpClientSpy

    beforeEach(() => {
      const result = makeSut()
      sut = result.sut
      httpClient = result.httpClient
      httpClient.getResult = { products: [makeShopifyProduct()] }
    })

    it('should call correct URL with auth header', async () => {
      await sut.getProducts({})

      expect(httpClient.calls).toHaveLength(1)
      expect(httpClient.call(0).url).toBe(
        'https://test-store.myshopify.com/admin/api/2024-01/products.json',
      )
      expect(httpClient.call(0).headers).toEqual({
        'X-Shopify-Access-Token': 'shpat_test_token',
      })
    })

    it('should append query params when provided', async () => {
      await sut.getProducts({ limit: 10, sinceId: '100' })

      expect(httpClient.call(0).url).toBe(
        'https://test-store.myshopify.com/admin/api/2024-01/products.json?limit=10&since_id=100',
      )
    })

    it('should map Shopify response to normalized Product[]', async () => {
      const products = await sut.getProducts({})

      expect(products).toHaveLength(1)
      expect(products[0]).toEqual({
        id: '123',
        title: 'Cool T-Shirt',
        price: 29.99,
        imageUrl: 'https://cdn.shopify.com/image.png',
        url: 'https://test-store.myshopify.com/products/cool-t-shirt',
        variants: [
          { id: '1001', title: 'Small', price: 29.99, sku: 'TSH-S' },
          { id: '1002', title: 'Large', price: 34.99, sku: null },
        ],
      })
    })

    it('should handle product without image', async () => {
      httpClient.getResult = { products: [makeShopifyProduct({ image: null })] }

      const products = await sut.getProducts({})
      expect(products[0]!.imageUrl).toBeNull()
    })
  })

  describe('getOrders', () => {
    let sut: ShopifyAdapter
    let httpClient: HttpClientSpy

    beforeEach(() => {
      const result = makeSut()
      sut = result.sut
      httpClient = result.httpClient
      httpClient.getResult = { orders: [makeShopifyOrder()] }
    })

    it('should call correct URL with auth header', async () => {
      await sut.getOrders({})

      expect(httpClient.call(0).url).toBe(
        'https://test-store.myshopify.com/admin/api/2024-01/orders.json',
      )
    })

    it('should append query params when provided', async () => {
      await sut.getOrders({ limit: 5, status: 'paid' })

      expect(httpClient.call(0).url).toContain('limit=5')
      expect(httpClient.call(0).url).toContain('status=paid')
    })

    it('should map Shopify response to normalized Order[]', async () => {
      const orders = await sut.getOrders({})

      expect(orders).toHaveLength(1)
      expect(orders[0]).toEqual({
        id: '456',
        orderNumber: '1001',
        totalPrice: 99.99,
        currency: 'BRL',
        lineItems: [{ productId: '123', title: 'Cool T-Shirt', quantity: 2, price: 29.99 }],
        customer: { id: '789', email: 'customer@test.com', name: 'John Doe', phone: '+5511999' },
        status: 'paid',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      })
    })

    it('should handle order without customer', async () => {
      httpClient.getResult = { orders: [makeShopifyOrder({ customer: null })] }

      const orders = await sut.getOrders({})
      expect(orders[0]!.customer).toEqual({ id: '', email: '', name: null, phone: null })
    })

    it('should map financial_status correctly', async () => {
      httpClient.getResult = { orders: [makeShopifyOrder({ financial_status: 'refunded' })] }

      const orders = await sut.getOrders({})
      expect(orders[0]!.status).toBe('refunded')
    })
  })

  describe('getAbandonedCarts', () => {
    let sut: ShopifyAdapter
    let httpClient: HttpClientSpy

    beforeEach(() => {
      const result = makeSut()
      sut = result.sut
      httpClient = result.httpClient
      httpClient.getResult = { checkouts: [makeShopifyCheckout()] }
    })

    it('should call checkouts endpoint with status=open', async () => {
      await sut.getAbandonedCarts()

      expect(httpClient.call(0).url).toBe(
        'https://test-store.myshopify.com/admin/api/2024-01/checkouts.json?status=open',
      )
    })

    it('should map response to normalized AbandonedCart[]', async () => {
      const carts = await sut.getAbandonedCarts()

      expect(carts).toHaveLength(1)
      expect(carts[0]).toEqual({
        id: '555',
        lineItems: [{ productId: '123', title: 'Cool T-Shirt', quantity: 1, price: 29.99 }],
        totalPrice: 49.99,
        customer: { id: '789', email: 'customer@test.com', name: 'Jane', phone: null },
        createdAt: new Date('2024-01-15T10:00:00Z'),
        checkoutUrl: 'https://test-store.myshopify.com/checkouts/abc123/recover',
      })
    })
  })

  describe('getCustomer', () => {
    let sut: ShopifyAdapter
    let httpClient: HttpClientSpy

    beforeEach(() => {
      const result = makeSut()
      sut = result.sut
      httpClient = result.httpClient
      httpClient.getResult = { customer: makeShopifyCustomer() }
    })

    it('should call correct URL', async () => {
      await sut.getCustomer('789')

      expect(httpClient.call(0).url).toBe(
        'https://test-store.myshopify.com/admin/api/2024-01/customers/789.json',
      )
    })

    it('should map response to normalized Customer', async () => {
      const customer = await sut.getCustomer('789')

      expect(customer).toEqual({
        id: '789',
        email: 'customer@test.com',
        name: 'John Doe',
        phone: '+5511999',
      })
    })
  })

  describe('registerWebhooks', () => {
    let sut: ShopifyAdapter
    let httpClient: HttpClientSpy

    beforeEach(() => {
      const result = makeSut()
      sut = result.sut
      httpClient = result.httpClient
    })

    it('should POST for each webhook', async () => {
      await sut.registerWebhooks([
        { topic: 'orders/create', address: 'https://api.appfy.com/webhooks/shopify' },
        { topic: 'orders/paid', address: 'https://api.appfy.com/webhooks/shopify' },
      ])

      expect(httpClient.calls).toHaveLength(2)
      expect(httpClient.call(0).method).toBe('post')
      expect(httpClient.call(0).url).toBe(
        'https://test-store.myshopify.com/admin/api/2024-01/webhooks.json',
      )
      expect(httpClient.call(0).body).toEqual({
        webhook: {
          topic: 'orders/create',
          address: 'https://api.appfy.com/webhooks/shopify',
          format: 'json',
        },
      })
    })

    it('should not call HTTP when hooks list is empty', async () => {
      await sut.registerWebhooks([])
      expect(httpClient.calls).toHaveLength(0)
    })
  })

  describe('custom API version', () => {
    it('should use custom API version in URL', async () => {
      const { sut, httpClient } = makeSut({ apiVersion: '2024-04' })
      httpClient.getResult = { products: [] }

      await sut.getProducts({})

      expect(httpClient.call(0).url).toContain('/admin/api/2024-04/')
    })
  })
})
