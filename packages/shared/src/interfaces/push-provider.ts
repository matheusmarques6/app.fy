/** Result of creating a push provider app */
export interface PushAppResult {
  readonly appId: string
  readonly apiKey: string
}

/** Push notification payload */
export interface PushNotificationPayload {
  readonly title: string
  readonly body: string
  readonly data?: Record<string, string>
  readonly imageUrl?: string
  readonly deepLink?: string
}

/** Result of sending a push notification */
export interface PushSendResult {
  readonly externalId: string
  readonly recipients: number
}

/** Delivery status from the push provider */
export interface PushDeliveryStatus {
  readonly externalId: string
  readonly successful: number
  readonly failed: number
  readonly errored: number
  readonly remaining: number
}

/** Device registration result */
export interface PushDeviceRegistration {
  readonly playerId: string
  readonly success: boolean
}

/**
 * Push provider contract (OneSignal).
 * Server-only: app never talks directly to push provider.
 */
export interface PushProvider {
  createApp(name: string): Promise<PushAppResult>
  sendNotification(
    appId: string,
    playerIds: readonly string[],
    payload: PushNotificationPayload,
  ): Promise<PushSendResult>
  getDeliveryStatus(appId: string, externalId: string): Promise<PushDeliveryStatus>
  registerDevice(
    appId: string,
    deviceToken: string,
    platform: 'android' | 'ios',
  ): Promise<PushDeviceRegistration>
}
