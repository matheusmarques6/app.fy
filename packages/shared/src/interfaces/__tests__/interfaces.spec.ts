import { describe, expect, it } from 'vitest'

import type {
  PlatformAdapter,
  PlatformProduct,
  PlatformOrder,
  PlatformAbandonedCart,
  PlatformCustomer,
  WebhookRegistration,
} from '../platform-adapter.js'
import type {
  PushProvider,
  PushAppResult,
  PushSendResult,
  PushDeliveryStatus,
  PushDeviceRegistration,
  PushNotificationPayload,
} from '../push-provider.js'

describe('PlatformAdapter Interface — Compilation', () => {
  it('PlatformProduct has required fields', () => {
    const product: PlatformProduct = {
      externalId: 'prod-1',
      title: 'T-Shirt',
      price: 49.90,
      currency: 'BRL',
      imageUrl: 'https://cdn.example.com/shirt.jpg',
      url: 'https://store.example.com/shirt',
    }
    expect(product.externalId).toBe('prod-1')
  })

  it('PlatformOrder has required fields', () => {
    const order: PlatformOrder = {
      externalId: 'order-1',
      customerEmail: 'customer@test.com',
      totalPrice: 129.90,
      currency: 'BRL',
      status: 'paid',
      createdAt: new Date(),
    }
    expect(order.status).toBe('paid')
  })

  it('PlatformAbandonedCart has items array', () => {
    const cart: PlatformAbandonedCart = {
      externalId: 'cart-1',
      customerEmail: 'customer@test.com',
      totalPrice: 199.80,
      currency: 'BRL',
      items: [
        { productId: 'p-1', title: 'Item 1', quantity: 2, price: 99.90 },
      ],
      createdAt: new Date(),
    }
    expect(cart.items).toHaveLength(1)
  })

  it('PlatformCustomer has required fields', () => {
    const customer: PlatformCustomer = {
      externalId: 'cust-1',
      email: 'customer@test.com',
      name: 'John',
      totalOrders: 10,
      totalSpent: 1500,
    }
    expect(customer.totalOrders).toBe(10)
  })

  it('WebhookRegistration has required fields', () => {
    const reg: WebhookRegistration = {
      webhookId: 'wh-1',
      topic: 'orders/create',
      address: 'https://api.appfy.com/webhooks/shopify',
    }
    expect(reg.topic).toBe('orders/create')
  })

  it('PlatformAdapter can be implemented as a class', () => {
    class MockAdapter implements PlatformAdapter {
      async getProducts() { return [] }
      async getOrders() { return [] }
      async getAbandonedCarts() { return [] }
      async getCustomer() { return null }
      async registerWebhooks() { return [] }
    }
    const adapter = new MockAdapter()
    expect(adapter).toBeDefined()
  })
})

describe('PushProvider Interface — Compilation', () => {
  it('PushAppResult has required fields', () => {
    const result: PushAppResult = { appId: 'os-1', apiKey: 'key-1' }
    expect(result.appId).toBe('os-1')
  })

  it('PushNotificationPayload has required and optional fields', () => {
    const payload: PushNotificationPayload = {
      title: 'Sale!',
      body: 'Get 50% off',
      data: { ref: 'push_n1' },
      imageUrl: 'https://cdn.example.com/banner.jpg',
      deepLink: 'appfy://product/123',
    }
    expect(payload.title).toBe('Sale!')
  })

  it('PushNotificationPayload works with only required fields', () => {
    const payload: PushNotificationPayload = {
      title: 'Hello',
      body: 'World',
    }
    expect(payload.data).toBeUndefined()
  })

  it('PushSendResult has required fields', () => {
    const result: PushSendResult = { externalId: 'ext-1', recipients: 150 }
    expect(result.recipients).toBe(150)
  })

  it('PushDeliveryStatus has required fields', () => {
    const status: PushDeliveryStatus = {
      externalId: 'ext-1',
      successful: 140,
      failed: 5,
      errored: 3,
      remaining: 2,
    }
    expect(status.successful).toBe(140)
  })

  it('PushDeviceRegistration has required fields', () => {
    const reg: PushDeviceRegistration = { playerId: 'player-1', success: true }
    expect(reg.success).toBe(true)
  })

  it('PushProvider can be implemented as a class', () => {
    class MockPushProvider implements PushProvider {
      async createApp(name: string) {
        return { appId: `app-${name}`, apiKey: 'key' }
      }
      async sendNotification() {
        return { externalId: 'ext-1', recipients: 1 }
      }
      async getDeliveryStatus() {
        return { externalId: 'ext-1', successful: 1, failed: 0, errored: 0, remaining: 0 }
      }
      async registerDevice() {
        return { playerId: 'p-1', success: true }
      }
    }
    const provider = new MockPushProvider()
    expect(provider).toBeDefined()
  })
})
