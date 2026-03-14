import { PushProviderError } from '../errors.js'
import type {
  PushAppConfig,
  PushDeliveryStatus,
  PushNotificationPayload,
  PushProvider,
  PushResult,
} from './push-provider.interface.js'

const ONESIGNAL_API_BASE = 'https://onesignal.com/api/v1'

/**
 * OneSignal implementation of PushProvider.
 * Each tenant gets its own OneSignal app (provisioned via REST API).
 */
export class OneSignalProvider implements PushProvider {
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async createApp(config: PushAppConfig): Promise<{ appId: string }> {
    const response = await fetch(`${ONESIGNAL_API_BASE}/apps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${this.apiKey}`,
      },
      body: JSON.stringify({
        name: config.name,
        apns_env: config.platform === 'ios' || config.platform === 'both' ? 'production' : undefined,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new PushProviderError('onesignal', `Failed to create app: ${response.status} ${text}`)
    }

    const data = (await response.json()) as { id: string }
    return { appId: data.id }
  }

  async sendNotification(
    appId: string,
    notification: PushNotificationPayload,
  ): Promise<PushResult> {
    const response = await fetch(`${ONESIGNAL_API_BASE}/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${this.apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_player_ids: notification.playerIds,
        headings: { en: notification.title },
        contents: { en: notification.body },
        ...(notification.imageUrl && { big_picture: notification.imageUrl }),
        ...(notification.targetUrl && { url: notification.targetUrl }),
        ...(notification.data && { data: notification.data }),
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new PushProviderError(
        'onesignal',
        `Failed to send notification: ${response.status} ${text}`,
      )
    }

    const data = (await response.json()) as { id: string; recipients: number }
    return {
      externalId: data.id,
      recipientCount: data.recipients,
    }
  }

  async getDeliveryStatus(appId: string, notificationId: string): Promise<PushDeliveryStatus> {
    const response = await fetch(
      `${ONESIGNAL_API_BASE}/notifications/${notificationId}?app_id=${appId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${this.apiKey}`,
        },
      },
    )

    if (!response.ok) {
      const text = await response.text()
      throw new PushProviderError(
        'onesignal',
        `Failed to get delivery status: ${response.status} ${text}`,
      )
    }

    const data = (await response.json()) as {
      successful: number
      failed: number
      remaining: number
    }
    return {
      successful: data.successful,
      failed: data.failed,
      remaining: data.remaining,
    }
  }

  async registerDevice(appId: string, deviceToken: string): Promise<{ playerId: string }> {
    const response = await fetch(`${ONESIGNAL_API_BASE}/players`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,
        identifier: deviceToken,
        device_type: 0, // iOS=0, Android=1 — caller should specify, defaulting to iOS
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new PushProviderError(
        'onesignal',
        `Failed to register device: ${response.status} ${text}`,
      )
    }

    const data = (await response.json()) as { id: string }
    return { playerId: data.id }
  }
}
