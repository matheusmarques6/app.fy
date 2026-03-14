import { createHmac, timingSafeEqual } from 'node:crypto'
import type { WebhookPayload } from '../types.js'

/**
 * Verify Shopify webhook HMAC signature.
 * Uses HMAC-SHA256 with the app's client secret.
 * Shopify sends the HMAC as base64 in the `X-Shopify-Hmac-Sha256` header.
 *
 * @param payload - Raw request body as string
 * @param hmac - HMAC from `X-Shopify-Hmac-Sha256` header
 * @param secret - Shopify client secret
 * @returns true if signature is valid
 */
export function verifyShopifyWebhook(payload: string, hmac: string, secret: string): boolean {
  const computed = createHmac('sha256', secret).update(payload, 'utf8').digest('base64')
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(hmac))
  } catch {
    return false // Different lengths → invalid
  }
}

/**
 * Parse raw Shopify webhook into normalized WebhookPayload.
 */
export function parseShopifyWebhook(
  topic: string,
  shopDomain: string,
  body: unknown,
  hmac: string,
): WebhookPayload {
  return { topic, shopDomain, data: body, hmac }
}
