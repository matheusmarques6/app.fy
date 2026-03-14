import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { parseNuvemshopWebhook, verifyNuvemshopWebhook } from './webhooks.js'

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function computeNuvemshopHmac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('verifyNuvemshopWebhook', () => {
  const secret = 'nuvemshop-test-secret-key'
  const payload = JSON.stringify({ id: 456, store_id: 123 })

  it('should return true for valid HMAC', () => {
    const hmac = computeNuvemshopHmac(payload, secret)
    expect(verifyNuvemshopWebhook(payload, hmac, secret)).toBe(true)
  })

  it('should return false for invalid HMAC', () => {
    expect(verifyNuvemshopWebhook(payload, 'invalid-hmac', secret)).toBe(false)
  })

  it('should return false for tampered payload', () => {
    const hmac = computeNuvemshopHmac(payload, secret)
    const tampered = JSON.stringify({ id: 999, store_id: 123 })
    expect(verifyNuvemshopWebhook(tampered, hmac, secret)).toBe(false)
  })

  it('should return false for wrong secret', () => {
    const hmac = computeNuvemshopHmac(payload, secret)
    expect(verifyNuvemshopWebhook(payload, hmac, 'wrong-secret')).toBe(false)
  })

  it('should return false for empty HMAC', () => {
    expect(verifyNuvemshopWebhook(payload, '', secret)).toBe(false)
  })
})

describe('parseNuvemshopWebhook', () => {
  it('should return normalized WebhookPayload', () => {
    const body = { id: 456, email: 'cliente@test.com' }
    const result = parseNuvemshopWebhook(
      'orders/created',
      'minha-loja.nuvemshop.com',
      body,
      'hmac-value',
    )

    expect(result).toEqual({
      topic: 'orders/created',
      shopDomain: 'minha-loja.nuvemshop.com',
      data: body,
      hmac: 'hmac-value',
    })
  })
})
