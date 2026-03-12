import type {
  PushAppConfig,
  PushDeliveryStatus,
  PushNotificationPayload,
  PushProvider,
  PushResult,
} from '@appfy/core'
import { SpyBase } from './spy-base.js'

export class PushProviderSpy extends SpyBase implements PushProvider {
  createAppResult = { appId: 'test-app-id' }
  sendResult: PushResult = { externalId: 'ext-1', recipientCount: 1 }
  deliveryStatusResult: PushDeliveryStatus = { successful: 1, failed: 0, remaining: 0 }
  registerDeviceResult = { playerId: 'player-1' }

  shouldFail = false
  failureMessage = 'Push provider test failure'

  async createApp(config: PushAppConfig): Promise<{ appId: string }> {
    this.trackCall('createApp', [config])
    if (this.shouldFail) throw new Error(this.failureMessage)
    return this.createAppResult
  }

  async sendNotification(
    appId: string,
    notification: PushNotificationPayload,
  ): Promise<PushResult> {
    this.trackCall('sendNotification', [appId, notification])
    if (this.shouldFail) throw new Error(this.failureMessage)
    return this.sendResult
  }

  async getDeliveryStatus(appId: string, notificationId: string): Promise<PushDeliveryStatus> {
    this.trackCall('getDeliveryStatus', [appId, notificationId])
    if (this.shouldFail) throw new Error(this.failureMessage)
    return this.deliveryStatusResult
  }

  async registerDevice(appId: string, deviceToken: string): Promise<{ playerId: string }> {
    this.trackCall('registerDevice', [appId, deviceToken])
    if (this.shouldFail) throw new Error(this.failureMessage)
    return this.registerDeviceResult
  }
}
