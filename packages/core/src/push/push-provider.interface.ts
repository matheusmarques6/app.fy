/** Result of sending a push notification */
export interface PushResult {
  readonly externalId: string
  readonly recipientCount: number
}

/** Delivery status from push provider */
export interface PushDeliveryStatus {
  readonly successful: number
  readonly failed: number
  readonly remaining: number
}

/** Configuration for creating a push app (e.g., OneSignal app per tenant) */
export interface PushAppConfig {
  readonly name: string
  readonly platform: 'android' | 'ios' | 'both'
}

/** Notification payload sent to push provider */
export interface PushNotificationPayload {
  readonly title: string
  readonly body: string
  readonly imageUrl?: string
  readonly targetUrl?: string
  readonly data?: Record<string, string>
  readonly playerIds: string[]
}

/**
 * Adapter interface for push notification providers.
 * Implemented by OneSignal, but swappable for tests or future providers.
 */
export interface PushProvider {
  createApp(config: PushAppConfig): Promise<{ appId: string }>
  sendNotification(appId: string, notification: PushNotificationPayload): Promise<PushResult>
  getDeliveryStatus(appId: string, notificationId: string): Promise<PushDeliveryStatus>
  registerDevice(appId: string, deviceToken: string): Promise<{ playerId: string }>
}
