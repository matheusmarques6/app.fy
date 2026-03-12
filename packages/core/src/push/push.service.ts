import type {
  PushDeliveryStatus,
  PushNotificationPayload,
  PushProvider,
  PushResult,
} from './push-provider.interface.js'

/**
 * Push notification service — delegates to PushProvider adapter.
 * Wraps provider calls with tenant-scoped operations.
 */
export class PushService {
  constructor(private readonly provider: PushProvider) {}

  async send(appId: string, notification: PushNotificationPayload): Promise<PushResult> {
    return this.provider.sendNotification(appId, notification)
  }

  async getStatus(appId: string, notificationId: string): Promise<PushDeliveryStatus> {
    return this.provider.getDeliveryStatus(appId, notificationId)
  }

  async registerDevice(appId: string, deviceToken: string): Promise<{ playerId: string }> {
    return this.provider.registerDevice(appId, deviceToken)
  }
}
