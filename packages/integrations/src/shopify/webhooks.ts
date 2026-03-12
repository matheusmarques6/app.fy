import type { WebhookPayload } from '../types.js'

/**
 * Verify Shopify webhook HMAC signature.
 * Uses HMAC-SHA256 with the app's client secret.
 *
 * @param payload - Raw request body as string
 * @param hmac - HMAC from `X-Shopify-Hmac-Sha256` header
 * @param secret - Shopify client secret
 * @returns true if signature is valid
 */
export function verifyShopifyWebhook(_payload: string, _hmac: string, _secret: string): boolean {
  // TODO: Implement HMAC-SHA256 verification
  // const hash = crypto.createHmac('sha256', secret).update(payload).digest('base64')
  // return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmac))
  throw new Error('Not implemented')
}

/**
 * Parse raw Shopify webhook into normalized WebhookPayload.
 */
export function parseShopifyWebhook(
  _topic: string,
  _shopDomain: string,
  _body: unknown,
  _hmac: string,
): WebhookPayload {
  throw new Error('Not implemented')
}
