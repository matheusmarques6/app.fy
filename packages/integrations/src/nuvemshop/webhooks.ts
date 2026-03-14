import { createHmac, timingSafeEqual } from 'node:crypto'
import type { WebhookPayload } from '../types.js'

/**
 * Verify Nuvemshop webhook signature.
 * Nuvemshop uses HMAC-SHA256 with hex encoding (unlike Shopify's base64).
 *
 * @param payload - Raw request body as string
 * @param hmac - HMAC from webhook header
 * @param secret - Nuvemshop app secret
 * @returns true if signature is valid
 */
export function verifyNuvemshopWebhook(payload: string, hmac: string, secret: string): boolean {
  const computed = createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(hmac))
  } catch {
    return false // Different lengths → invalid
  }
}

/**
 * Parse raw Nuvemshop webhook into normalized WebhookPayload.
 */
export function parseNuvemshopWebhook(
  topic: string,
  shopDomain: string,
  body: unknown,
  hmac: string,
): WebhookPayload {
  return { topic, shopDomain, data: body, hmac }
}
