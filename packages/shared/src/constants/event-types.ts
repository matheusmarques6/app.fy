/** App events tracked by the SDK */
export const appEventTypes = [
  'app_opened',
  'product_viewed',
  'add_to_cart',
  'purchase_completed',
  'push_opened',
  'push_clicked',
] as const

export type AppEventType = (typeof appEventTypes)[number]

/** Delivery status for push notifications */
export const deliveryStatuses = [
  'pending',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'converted',
  'failed',
] as const

export type DeliveryStatus = (typeof deliveryStatuses)[number]

/** Notification types */
export const notificationTypes = ['manual', 'automated'] as const
export type NotificationType = (typeof notificationTypes)[number]

/** Notification lifecycle status */
export const notificationStatuses = [
  'draft',
  'approved',
  'scheduled',
  'sending',
  'sent',
  'failed',
] as const

export type NotificationStatus = (typeof notificationStatuses)[number]

/** App build status */
export const buildStatuses = ['pending', 'building', 'ready', 'published'] as const
export type BuildStatus = (typeof buildStatuses)[number]

/** Supported e-commerce platforms */
export const platforms = ['shopify', 'nuvemshop'] as const
export type Platform = (typeof platforms)[number]

/** Mobile device platforms */
export const devicePlatforms = ['android', 'ios'] as const
export type DevicePlatform = (typeof devicePlatforms)[number]
