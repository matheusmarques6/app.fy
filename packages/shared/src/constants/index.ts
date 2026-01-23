/**
 * Application constants
 */

// JWT
export const JWT_ISSUER = 'appfy-auth';
export const JWT_AUDIENCE_DEVICE = 'appfy-device';
export const JWT_AUDIENCE_USER = 'appfy-console';
export const JWT_ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes in seconds
export const JWT_REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

// Rate Limits
export const RATE_LIMIT_EVENTS_PER_DEVICE = 100; // per minute
export const RATE_LIMIT_EVENTS_PER_STORE = 500; // per second
export const RATE_LIMIT_REGISTER_PER_IP = 10; // per minute
export const RATE_LIMIT_REFRESH_PER_DEVICE = 10; // per minute

// Push
export const PUSH_MAX_PER_DEVICE_PER_DAY = 5;
export const PUSH_MAX_PER_STORE_PER_MINUTE = 10000;
export const PUSH_QUIET_HOURS_DEFAULT_START = '22:00';
export const PUSH_QUIET_HOURS_DEFAULT_END = '08:00';

// Events
export const EVENT_BATCH_MAX_SIZE = 200;
export const EVENT_PROPS_MAX_SIZE_BYTES = 16384; // 16KB
export const EVENT_MAX_AGE_DAYS = 7;

// Remote Config
export const REMOTE_CONFIG_TTL_SECONDS = 300; // 5 minutes
export const REMOTE_CONFIG_MAX_AGE_DAYS = 7;

// Attribution
export const ATTRIBUTION_WINDOW_HOURS = 48;

// Segments
export const SEGMENT_REFRESH_BATCH_SIZE = 1000;
export const SEGMENT_MAX_RULES = 20;

// Automations
export const AUTOMATION_MAX_NODES = 50;
export const AUTOMATION_MAX_DELAY_DAYS = 30;

// Security
export const FINGERPRINT_HASH_ALGORITHM = 'sha256';
export const REFRESH_TOKEN_HASH_ALGORITHM = 'sha256';
export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300; // 5 minutes

// Queues
export const QUEUE_NAMES = {
  EVENTS_INGEST: 'events:ingest',
  METRICS_UPDATE: 'metrics:update',
  SEGMENT_REFRESH: 'segment:refresh',
  AUTOMATION_EVAL: 'automation:eval',
  CAMPAIGN_SCHEDULER: 'campaign:scheduler',
  CAMPAIGN_SEND: 'campaign:send',
  PUSH_SEND: 'push:send',
  INTEGRATIONS_SYNC: 'integrations:sync',
  AI_JOBS: 'ai:jobs',
  BUILD: 'build:jobs',
  PUBLISH: 'publish:jobs',
} as const;

// Event Names (allowed)
export const ALLOWED_EVENT_NAMES = [
  'app_open',
  'app_close',
  'view_product',
  'view_collection',
  'view_cart',
  'add_to_cart',
  'remove_from_cart',
  'begin_checkout',
  'purchase_detected',
  'purchase_confirmed',
  'search',
  'add_to_wishlist',
  'remove_from_wishlist',
  'push_received',
  'push_opened',
  'push_clicked',
  'custom',
] as const;

// Supported Platforms
export const SUPPORTED_PLATFORMS = ['shopify', 'woocommerce'] as const;

// Supported Locales (initial)
export const SUPPORTED_LOCALES = [
  'en-US',
  'pt-BR',
  'es-ES',
  'es-MX',
  'fr-FR',
  'de-DE',
  'it-IT',
] as const;
