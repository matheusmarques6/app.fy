import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { parseShopifyWebhook, verifyShopifyWebhook } from './webhooks.js'

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function computeShopifyHmac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('base64')
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('verifyShopifyWebhook', () => {
  const secret = 'shopify-test-secret-key'
  const payload = JSON.stringify({ id: 123, topic: 'orders/create' })

  it('should return true for valid HMAC', () => {
    const hmac = computeShopifyHmac(payload, secret)
    expect(verifyShopifyWebhook(payload, hmac, secret)).toBe(true)
  })

  it('should return false for invalid HMAC', () => {
    expect(verifyShopifyWebhook(payload, 'invalid-hmac-value', secret)).toBe(false)
  })

  it('should return false for tampered payload', () => {
    const hmac = computeShopifyHmac(payload, secret)
    const tampered = JSON.stringify({ id: 999, topic: 'orders/create' })
    expect(verifyShopifyWebhook(tampered, hmac, secret)).toBe(false)
  })

  it('should return false for wrong secret', () => {
    const hmac = computeShopifyHmac(payload, secret)
    expect(verifyShopifyWebhook(payload, hmac, 'wrong-secret')).toBe(false)
  })

  it('should return false for empty HMAC', () => {
    expect(verifyShopifyWebhook(payload, '', secret)).toBe(false)
  })
})

describe('parseShopifyWebhook', () => {
  it('should return normalized WebhookPayload', () => {
    const body = { id: 123, email: 'test@test.com' }
    const result = parseShopifyWebhook('orders/create', 'test-store.myshopify.com', body, 'hmac-value')

    expect(result).toEqual({
      topic: 'orders/create',
      shopDomain: 'test-store.myshopify.com',
      data: body,
      hmac: 'hmac-value',
    })
  })
})
