// Platform adapter contract

export type {
  KlaviyoAdapter,
  KlaviyoConfig,
  KlaviyoMetric,
  KlaviyoProfile,
  KlaviyoSegment,
} from './klaviyo/index.js'
// Klaviyo
export { KlaviyoRestAdapter } from './klaviyo/index.js'
export type { NuvemshopConfig, NuvemshopWebhookTopic } from './nuvemshop/index.js'
// Nuvemshop
export {
  NUVEMSHOP_DOMAIN_PATTERN,
  NUVEMSHOP_WEBHOOK_TOPICS,
  NuvemshopAdapter,
  parseNuvemshopWebhook,
  verifyNuvemshopWebhook,
} from './nuvemshop/index.js'
export type { PlatformAdapter, PlatformAdapterConfig } from './platform-adapter.interface.js'
export type { ShopifyConfig, ShopifyWebhookTopic } from './shopify/index.js'
// Shopify
export {
  parseShopifyWebhook,
  SHOPIFY_DOMAIN_PATTERN,
  SHOPIFY_REQUIRED_SCOPES,
  SHOPIFY_WEBHOOK_TOPICS,
  ShopifyAdapter,
  verifyShopifyWebhook,
} from './shopify/index.js'
// Normalized types
export type {
  AbandonedCart,
  Customer,
  LineItem,
  Order,
  OrderQuery,
  OrderStatus,
  Product,
  ProductQuery,
  ProductVariant,
  WebhookConfig,
  WebhookPayload,
} from './types.js'
