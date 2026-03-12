import type { PlatformAdapterConfig } from '../platform-adapter.interface.js'

export interface NuvemshopConfig extends PlatformAdapterConfig {
  readonly appId: string
  readonly appSecret: string
}

/** SSRF whitelist pattern for Nuvemshop domains (includes Brazilian .lojavirtualnuvem.com.br variant) */
export const NUVEMSHOP_DOMAIN_PATTERN = /^[\w-]+\.(nuvemshop\.com|lojavirtualnuvem\.com\.br)$/

/**
 * Nuvemshop webhook topics mapped to internal events.
 */
export const NUVEMSHOP_WEBHOOK_TOPICS = [
  'orders/created',
  'orders/paid',
  'orders/cancelled',
  'carts/created',
  'carts/updated',
  'checkouts/created',
  'checkouts/updated',
  'fulfillments/created',
  'app/uninstalled',
] as const

export type NuvemshopWebhookTopic = (typeof NUVEMSHOP_WEBHOOK_TOPICS)[number]
