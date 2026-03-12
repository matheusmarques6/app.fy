import { PushProviderError } from '../errors.js'
import type {
  PushAppConfig,
  PushDeliveryStatus,
  PushNotificationPayload,
  PushProvider,
  PushResult,
} from './push-provider.interface.js'

/**
 * OneSignal implementation of PushProvider.
 * Each tenant gets its own OneSignal app (provisioned via REST API).
 *
 * Stub — real HTTP calls implemented during TDD.
 */
export class OneSignalProvider implements PushProvider {
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async createApp(_config: PushAppConfig): Promise<{ appId: string }> {
    void this.apiKey
    throw new PushProviderError('onesignal', 'Not implemented')
  }

  async sendNotification(
    _appId: string,
    _notification: PushNotificationPayload,
  ): Promise<PushResult> {
    throw new PushProviderError('onesignal', 'Not implemented')
  }

  async getDeliveryStatus(_appId: string, _notificationId: string): Promise<PushDeliveryStatus> {
    throw new PushProviderError('onesignal', 'Not implemented')
  }

  async registerDevice(_appId: string, _deviceToken: string): Promise<{ playerId: string }> {
    throw new PushProviderError('onesignal', 'Not implemented')
  }
}
