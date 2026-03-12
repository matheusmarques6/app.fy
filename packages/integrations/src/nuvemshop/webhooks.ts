import type { WebhookPayload } from '../types.js'

/**
 * Verify Nuvemshop webhook signature.
 *
 * @param payload - Raw request body as string
 * @param hmac - HMAC from webhook header
 * @param secret - Nuvemshop app secret
 * @returns true if signature is valid
 */
export function verifyNuvemshopWebhook(_payload: string, _hmac: string, _secret: string): boolean {
  // TODO: Implement HMAC verification per Nuvemshop docs
  throw new Error('Not implemented')
}

/**
 * Parse raw Nuvemshop webhook into normalized WebhookPayload.
 */
export function parseNuvemshopWebhook(
  _topic: string,
  _shopDomain: string,
  _body: unknown,
  _hmac: string,
): WebhookPayload {
  throw new Error('Not implemented')
}
