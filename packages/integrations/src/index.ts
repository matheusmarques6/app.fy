// Platform adapter contract
export type { PlatformAdapter, PlatformAdapterConfig } from './platform-adapter.interface.js'

// HTTP Client
export type { HttpClient } from './http-client.js'
export { FetchHttpClient } from './http-client.js'

// OAuth
export type { OAuthConfig, OAuthTokenResponse } from './oauth.service.js'
export { buildNuvemshopOAuthUrl, buildShopifyOAuthUrl } from './oauth.service.js'

// Shopify
export { ShopifyAdapter } from './shopify/index.js'
export type { ShopifyConfig, ShopifyWebhookTopic } from './shopify/index.js'
export {
  parseShopifyWebhook,
  SHOPIFY_DOMAIN_PATTERN,
  SHOPIFY_REQUIRED_SCOPES,
  SHOPIFY_WEBHOOK_TOPICS,
  verifyShopifyWebhook,
} from './shopify/index.js'

// Nuvemshop
export { NuvemshopAdapter } from './nuvemshop/index.js'
export type { NuvemshopConfig, NuvemshopWebhookTopic } from './nuvemshop/index.js'
export {
  NUVEMSHOP_DOMAIN_PATTERN,
  NUVEMSHOP_WEBHOOK_TOPICS,
  parseNuvemshopWebhook,
  verifyNuvemshopWebhook,
} from './nuvemshop/index.js'

// Klaviyo
export { KlaviyoFetchClient, KlaviyoRestAdapter } from './klaviyo/index.js'
export type {
  KlaviyoAdapter,
  KlaviyoConfig,
  KlaviyoHttpClient,
  KlaviyoMetric,
  KlaviyoProfile,
  KlaviyoSegment,
} from './klaviyo/index.js'

// Webhook flow mapping
export { mapWebhookToFlowType, WEBHOOK_FLOW_MAP } from './webhook-flow-map.js'

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
