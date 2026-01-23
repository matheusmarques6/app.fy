import { Injectable, Logger } from '@nestjs/common';
import {
  PushProvider,
  PushProviderConfig,
  PushMessage,
  PushTarget,
  PushResult,
} from './push-provider.interface';

const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1';

@Injectable()
export class OneSignalProvider implements PushProvider {
  private readonly logger = new Logger(OneSignalProvider.name);

  async send(
    config: PushProviderConfig,
    message: PushMessage,
    target: PushTarget,
  ): Promise<PushResult> {
    const payload: Record<string, any> = {
      app_id: config.appId,
      headings: { en: message.title },
      contents: { en: message.body },
    };

    // Add optional fields
    if (message.data) {
      payload.data = message.data;
    }

    if (message.imageUrl) {
      payload.big_picture = message.imageUrl;
      payload.ios_attachments = { image: message.imageUrl };
    }

    if (message.actionUrl) {
      payload.url = message.actionUrl;
    }

    if (message.badge !== undefined) {
      payload.ios_badgeType = 'SetTo';
      payload.ios_badgeCount = message.badge;
    }

    if (message.sound) {
      payload.ios_sound = message.sound;
      payload.android_sound = message.sound;
    }

    // Set target
    if (target.subscriberIds?.length) {
      payload.include_player_ids = target.subscriberIds;
    } else if (target.tags) {
      payload.filters = Object.entries(target.tags).map(([key, value]) => ({
        field: 'tag',
        key,
        value,
      }));
    } else if (target.segmentName) {
      payload.included_segments = [target.segmentName];
    } else {
      // Default to all subscribers (be careful with this!)
      payload.included_segments = ['Subscribed Users'];
    }

    try {
      const response = await fetch(`${ONESIGNAL_API_URL}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${config.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        this.logger.error('OneSignal API error:', data);
        return {
          success: false,
          errors: data.errors || [data.error || 'Unknown error'],
        };
      }

      return {
        success: true,
        notificationId: data.id,
        recipients: data.recipients,
      };
    } catch (error: any) {
      this.logger.error('OneSignal request failed:', error);
      return {
        success: false,
        errors: [error.message || 'Request failed'],
      };
    }
  }

  async sendToSubscriber(
    config: PushProviderConfig,
    subscriberId: string,
    message: PushMessage,
  ): Promise<PushResult> {
    return this.send(config, message, { subscriberIds: [subscriberId] });
  }

  async cancel(
    config: PushProviderConfig,
    notificationId: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${ONESIGNAL_API_URL}/notifications/${notificationId}?app_id=${config.appId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Basic ${config.apiKey}`,
          },
        },
      );

      return response.ok;
    } catch (error) {
      this.logger.error('Failed to cancel notification:', error);
      return false;
    }
  }

  async getStats(
    config: PushProviderConfig,
    notificationId: string,
  ): Promise<{
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  }> {
    try {
      const response = await fetch(
        `${ONESIGNAL_API_URL}/notifications/${notificationId}?app_id=${config.appId}`,
        {
          headers: {
            Authorization: `Basic ${config.apiKey}`,
          },
        },
      );

      if (!response.ok) {
        return { sent: 0, delivered: 0, opened: 0, clicked: 0 };
      }

      const data = await response.json();

      return {
        sent: data.successful || 0,
        delivered: data.converted || data.successful || 0,
        opened: data.opened || 0,
        clicked: data.clicked || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get notification stats:', error);
      return { sent: 0, delivered: 0, opened: 0, clicked: 0 };
    }
  }
}
