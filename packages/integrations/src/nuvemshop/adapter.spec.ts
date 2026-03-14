import { beforeEach, describe, expect, it } from 'vitest'
import type { HttpClient } from '../http-client.js'
import { NuvemshopAdapter } from './adapter.js'
import type { NuvemshopConfig } from './types.js'

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

const defaultConfig: NuvemshopConfig = {
  shopDomain: 'minha-loja.nuvemshop.com',
  accessToken: 'ns_test_token',
  appId: 'test-app-id',
  appSecret: 'test-app-secret',
}

function makeNuvemshopProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    name: { pt: 'Camiseta Legal' },
    handle: { pt: 'camiseta-legal' },
    images: [{ src: 'https://d2r9epyceweg5n.cloudfront.net/image.png' }],
    variants: [
      { id: 2001, name: 'P', price: '59.90', sku: 'CAM-P' },
      { id: 2002, name: 'G', price: '64.90', sku: null },
    ],
    ...overrides,
  }
}

function makeNuvemshopOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 200,
    number: '1001',
    total: '119.80',
    currency: 'BRL',
    payment_status: 'paid',
    products: [{ product_id: 100, name: 'Camiseta Legal', quantity: 2, price: '59.90' }],
    customer: { id: 300, email: 'cliente@test.com', name: 'Maria Silva', phone: '+5511888' },
    created_at: '2024-01-15T10:00:00Z',
    ...overrides,
  }
}

function makeNuvemshopCheckout(overrides: Record<string, unknown> = {}) {
  return {
    id: 400,
    token: 'xyz789',
    total: '59.90',
    checkout_url: 'https://minha-loja.nuvemshop.com/checkout/xyz789',
    products: [{ product_id: 100, name: 'Camiseta Legal', quantity: 1, price: '59.90' }],
    customer: { id: 300, email: 'cliente@test.com', name: 'Maria', phone: null },
    created_at: '2024-01-15T10:00:00Z',
    ...overrides,
  }
}

function makeNuvemshopCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 300,
    email: 'cliente@test.com',
    name: 'Maria Silva',
    phone: '+5511888',
    ...overrides,
  }
}

// ──────────────────────────────────────────────
// makeSut
// ──────────────────────────────────────────────

function makeSut(configOverrides: Partial<NuvemshopConfig> = {}) {
  const httpClient = new HttpClientSpy()
  const config = { ...defaultConfig, ...configOverrides }
  const sut = new NuvemshopAdapter(config, httpClient)
  return { sut, httpClient }
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('NuvemshopAdapter', () => {
  describe('constructor', () => {
    it('should reject invalid Nuvemshop domains', () => {
      expect(() => makeSut({ shopDomain: 'evil.example.com' })).toThrow(/Invalid Nuvemshop domain/)
    })

    it('should reject subdomain spoofing', () => {
      expect(() => makeSut({ shopDomain: 'nuvemshop.com.evil.com' })).toThrow(/Invalid Nuvemshop domain/)
    })

    it('should accept valid *.nuvemshop.com domains', () => {
      const { sut } = makeSut()
      expect(sut.platform).toBe('nuvemshop')
    })

    it('should accept valid *.lojavirtualnuvem.com.br domains', () => {
      const { sut } = makeSut({ shopDomain: 'minha-loja.lojavirtualnuvem.com.br' })
      expect(sut.platform).toBe('nuvemshop')
    })
  })

  describe('getProducts', () => {
    let sut: NuvemshopAdapter
    let httpClient: HttpClientSpy

    beforeEach(() => {
      const result = makeSut()
      sut = result.sut
      httpClient = result.httpClient
      httpClient.getResult = [makeNuvemshopProduct()]
    })

    it('should call correct URL with auth header', async () => {
      await sut.getProducts({})

      expect(httpClient.calls).toHaveLength(1)
      expect(httpClient.call(0).url).toBe('https://api.nuvemshop.com.br/v1/minha-loja/products')
      expect(httpClient.call(0).headers).toEqual({
        Authentication: 'bearer ns_test_token',
        'User-Agent': 'AppFy/1.0',
      })
    })

    it('should append query params when provided', async () => {
      await sut.getProducts({ limit: 10, sinceId: '50' })

      expect(httpClient.call(0).url).toBe(
        'https://api.nuvemshop.com.br/v1/minha-loja/products?per_page=10&since_id=50',
      )
    })

    it('should map Nuvemshop response to normalized Product[]', async () => {
      const products = await sut.getProducts({})

      expect(products).toHaveLength(1)
      expect(products[0]).toEqual({
        id: '100',
        title: 'Camiseta Legal',
        price: 59.9,
        imageUrl: 'https://d2r9epyceweg5n.cloudfront.net/image.png',
        url: 'https://minha-loja.nuvemshop.com/produtos/camiseta-legal',
        variants: [
          { id: '2001', title: 'P', price: 59.9, sku: 'CAM-P' },
          { id: '2002', title: 'G', price: 64.9, sku: null },
        ],
      })
    })

    it('should handle product without images', async () => {
      httpClient.getResult = [makeNuvemshopProduct({ images: [] })]

      const products = await sut.getProducts({})
      expect(products[0]!.imageUrl).toBeNull()
    })

    it('should handle string name fields (non-localized)', async () => {
      httpClient.getResult = [makeNuvemshopProduct({ name: 'Simple Name', handle: 'simple-name' })]

      const products = await sut.getProducts({})
      expect(products[0]!.title).toBe('Simple Name')
      expect(products[0]!.url).toContain('/produtos/simple-name')
    })
  })

  describe('getOrders', () => {
    let sut: NuvemshopAdapter
    let httpClient: HttpClientSpy

    beforeEach(() => {
      const result = makeSut()
      sut = result.sut
      httpClient = result.httpClient
      httpClient.getResult = [makeNuvemshopOrder()]
    })

    it('should call correct URL', async () => {
      await sut.getOrders({})

      expect(httpClient.call(0).url).toBe('https://api.nuvemshop.com.br/v1/minha-loja/orders')
    })

    it('should append query params', async () => {
      await sut.getOrders({ limit: 5, status: 'paid' })

      expect(httpClient.call(0).url).toContain('per_page=5')
      expect(httpClient.call(0).url).toContain('payment_status=paid')
    })

    it('should map response to normalized Order[]', async () => {
      const orders = await sut.getOrders({})

      expect(orders).toHaveLength(1)
      expect(orders[0]).toEqual({
        id: '200',
        orderNumber: '1001',
        totalPrice: 119.8,
        currency: 'BRL',
        lineItems: [{ productId: '100', title: 'Camiseta Legal', quantity: 2, price: 59.9 }],
        customer: { id: '300', email: 'cliente@test.com', name: 'Maria Silva', phone: '+5511888' },
        status: 'paid',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      })
    })

    it('should handle order without customer', async () => {
      httpClient.getResult = [makeNuvemshopOrder({ customer: null })]

      const orders = await sut.getOrders({})
      expect(orders[0]!.customer).toEqual({ id: '', email: '', name: null, phone: null })
    })
  })

  describe('getAbandonedCarts', () => {
    let sut: NuvemshopAdapter
    let httpClient: HttpClientSpy

    beforeEach(() => {
      const result = makeSut()
      sut = result.sut
      httpClient = result.httpClient
      httpClient.getResult = [makeNuvemshopCheckout()]
    })

    it('should call checkouts endpoint with status=open', async () => {
      await sut.getAbandonedCarts()

      expect(httpClient.call(0).url).toBe(
        'https://api.nuvemshop.com.br/v1/minha-loja/checkouts?status=open',
      )
    })

    it('should map response to normalized AbandonedCart[]', async () => {
      const carts = await sut.getAbandonedCarts()

      expect(carts).toHaveLength(1)
      expect(carts[0]).toEqual({
        id: '400',
        lineItems: [{ productId: '100', title: 'Camiseta Legal', quantity: 1, price: 59.9 }],
        totalPrice: 59.9,
        customer: { id: '300', email: 'cliente@test.com', name: 'Maria', phone: null },
        createdAt: new Date('2024-01-15T10:00:00Z'),
        checkoutUrl: 'https://minha-loja.nuvemshop.com/checkout/xyz789',
      })
    })
  })

  describe('getCustomer', () => {
    let sut: NuvemshopAdapter
    let httpClient: HttpClientSpy

    beforeEach(() => {
      const result = makeSut()
      sut = result.sut
      httpClient = result.httpClient
      httpClient.getResult = makeNuvemshopCustomer()
    })

    it('should call correct URL', async () => {
      await sut.getCustomer('300')

      expect(httpClient.call(0).url).toBe('https://api.nuvemshop.com.br/v1/minha-loja/customers/300')
    })

    it('should map response to normalized Customer', async () => {
      const customer = await sut.getCustomer('300')

      expect(customer).toEqual({
        id: '300',
        email: 'cliente@test.com',
        name: 'Maria Silva',
        phone: '+5511888',
      })
    })
  })

  describe('registerWebhooks', () => {
    let sut: NuvemshopAdapter
    let httpClient: HttpClientSpy

    beforeEach(() => {
      const result = makeSut()
      sut = result.sut
      httpClient = result.httpClient
    })

    it('should POST for each webhook', async () => {
      await sut.registerWebhooks([
        { topic: 'orders/created', address: 'https://api.appfy.com/webhooks/nuvemshop' },
        { topic: 'orders/paid', address: 'https://api.appfy.com/webhooks/nuvemshop' },
      ])

      expect(httpClient.calls).toHaveLength(2)
      expect(httpClient.call(0).method).toBe('post')
      expect(httpClient.call(0).url).toBe('https://api.nuvemshop.com.br/v1/minha-loja/webhooks')
      expect(httpClient.call(0).body).toEqual({
        event: 'orders/created',
        url: 'https://api.appfy.com/webhooks/nuvemshop',
      })
    })

    it('should not call HTTP when hooks list is empty', async () => {
      await sut.registerWebhooks([])
      expect(httpClient.calls).toHaveLength(0)
    })
  })
})
