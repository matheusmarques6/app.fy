/**
 * Push Provider Interface
 * Abstraction layer for push notification providers (OneSignal, Firebase, etc.)
 */

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  actionUrl?: string;
  badge?: number;
  sound?: string;
}

export interface PushTarget {
  // Target specific subscribers
  subscriberIds?: string[];
  // Target by tags (OneSignal-specific)
  tags?: Record<string, string>;
  // Target segment
  segmentName?: string;
}

export interface PushResult {
  success: boolean;
  notificationId?: string;
  recipients?: number;
  errors?: string[];
}

export interface PushProviderConfig {
  appId: string;
  apiKey: string;
}

export interface PushProvider {
  /**
   * Send a push notification
   */
  send(
    config: PushProviderConfig,
    message: PushMessage,
    target: PushTarget,
  ): Promise<PushResult>;

  /**
   * Send to a single subscriber
   */
  sendToSubscriber(
    config: PushProviderConfig,
    subscriberId: string,
    message: PushMessage,
  ): Promise<PushResult>;

  /**
   * Cancel a scheduled notification
   */
  cancel(config: PushProviderConfig, notificationId: string): Promise<boolean>;

  /**
   * Get notification delivery stats
   */
  getStats(
    config: PushProviderConfig,
    notificationId: string,
  ): Promise<{
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  }>;
}
