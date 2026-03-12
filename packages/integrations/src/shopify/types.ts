import type { PlatformAdapterConfig } from '../platform-adapter.interface.js'

export interface ShopifyConfig extends PlatformAdapterConfig {
  readonly clientId: string
  readonly clientSecret: string
  readonly apiVersion?: string
}

/** Minimum required OAuth scopes for Shopify */
export const SHOPIFY_REQUIRED_SCOPES = ['read_products', 'read_orders', 'read_customers'] as const

/** SSRF whitelist pattern for Shopify domains */
export const SHOPIFY_DOMAIN_PATTERN = /^[\w-]+\.myshopify\.com$/

/**
 * Shopify webhook topics the system needs to register.
 */
export const SHOPIFY_WEBHOOK_TOPICS = [
  // --- Spec-defined topics ---
  'orders/create',
  'orders/paid',
  'carts/create',
  'checkouts/create',
  'fulfillments/create',
  'app/uninstalled',
  // --- Extra topics (intentional, needed by notification flows) ---
  'orders/cancelled', // Cancel pending notifications when order is cancelled
  'carts/update', // Detect cart abandonment by tracking cart changes
  'checkouts/update', // Detect checkout abandonment by tracking checkout changes
] as const

export type ShopifyWebhookTopic = (typeof SHOPIFY_WEBHOOK_TOPICS)[number]
