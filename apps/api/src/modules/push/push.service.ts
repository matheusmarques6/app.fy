// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OneSignalProvider } from './providers/onesignal.provider';
import type { PushMessage, PushResult } from './providers/push-provider.interface';
import { PUSH_MAX_PER_DEVICE_PER_DAY } from '@appfy/shared';

interface SendPushOptions {
  storeId: string;
  deviceId?: string;
  segmentId?: string;
  campaignId?: string;
  automationRunId?: string;
  message: PushMessage;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly onesignal: OneSignalProvider,
  ) {}

  /**
   * Send push to a specific device
   */
  async sendToDevice(options: SendPushOptions): Promise<PushResult> {
    const { storeId, deviceId, message, campaignId, automationRunId } = options;

    if (!deviceId) {
      return { success: false, errors: ['Device ID is required'] };
    }

    // Get store's OneSignal config
    const config = await this.getStoreConfig(storeId);
    if (!config) {
      return { success: false, errors: ['Push not configured for this store'] };
    }

    // Get device's push subscription
    const subscription = await this.prisma.pushSubscription.findFirst({
      where: {
        device_id: deviceId,
        provider: 'onesignal',
        opt_in: true,
      },
    });

    if (!subscription) {
      return { success: false, errors: ['Device not subscribed to push'] };
    }

    // Check rate limit
    const isAllowed = await this.checkRateLimit(deviceId);
    if (!isAllowed) {
      this.logger.warn(`Push rate limit exceeded for device ${deviceId}`);
      return { success: false, errors: ['Rate limit exceeded'] };
    }

    // Send via OneSignal
    const result = await this.onesignal.sendToSubscriber(
      config,
      subscription.provider_sub_id,
      message,
    );

    // Create delivery record
    await this.createDelivery({
      storeId,
      deviceId,
      campaignId,
      automationRunId,
      message,
      result,
      providerNotificationId: result.notificationId,
    });

    return result;
  }

  /**
   * Send push to a segment
   */
  async sendToSegment(options: SendPushOptions): Promise<PushResult> {
    const { storeId, segmentId, message, campaignId } = options;

    if (!segmentId) {
      return { success: false, errors: ['Segment ID is required'] };
    }

    // Get store's OneSignal config
    const config = await this.getStoreConfig(storeId);
    if (!config) {
      return { success: false, errors: ['Push not configured for this store'] };
    }

    // Get all subscribed devices in segment
    const memberships = await this.prisma.segmentMembership.findMany({
      where: {
        segment_id: segmentId,
        exited_at: null,
        device: {
          push_subscriptions: {
            some: {
              provider: 'onesignal',
              opt_in: true,
            },
          },
        },
      },
      include: {
        device: {
          include: {
            push_subscriptions: {
              where: {
                provider: 'onesignal',
                opt_in: true,
              },
            },
          },
        },
      },
    });

    const subscriberIds = memberships
      .map((m) => m.device.push_subscriptions[0]?.provider_sub_id)
      .filter(Boolean) as string[];

    if (subscriberIds.length === 0) {
      return { success: true, recipients: 0 };
    }

    // Batch send (OneSignal supports up to 2000 player_ids per request)
    const BATCH_SIZE = 2000;
    let totalRecipients = 0;
    const errors: string[] = [];

    for (let i = 0; i < subscriberIds.length; i += BATCH_SIZE) {
      const batch = subscriberIds.slice(i, i + BATCH_SIZE);

      const result = await this.onesignal.send(config, message, {
        subscriberIds: batch,
      });

      if (result.success) {
        totalRecipients += result.recipients || 0;

        // Create delivery records for each device in batch
        const deviceIds = memberships
          .slice(i, i + BATCH_SIZE)
          .map((m) => m.device_id);

        await this.createBulkDeliveries({
          storeId,
          deviceIds,
          campaignId,
          message,
          providerNotificationId: result.notificationId,
        });
      } else {
        errors.push(...(result.errors || []));
      }
    }

    return {
      success: errors.length === 0,
      recipients: totalRecipients,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Get OneSignal config for a store
   */
  private async getStoreConfig(storeId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: {
        store_id: storeId,
        provider: 'onesignal',
        is_active: true,
      },
    });

    if (!integration?.credentials) {
      return null;
    }

    const creds = integration.credentials as Record<string, string>;
    return {
      appId: creds.app_id,
      apiKey: creds.rest_api_key,
    };
  }

  /**
   * Check rate limit for a device
   */
  private async checkRateLimit(deviceId: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await this.prisma.delivery.count({
      where: {
        device_id: deviceId,
        created_at: { gte: today },
        status: { not: 'failed' },
      },
    });

    return count < PUSH_MAX_PER_DEVICE_PER_DAY;
  }

  /**
   * Create a delivery record
   */
  private async createDelivery(params: {
    storeId: string;
    deviceId: string;
    campaignId?: string;
    automationRunId?: string;
    message: PushMessage;
    result: PushResult;
    providerNotificationId?: string;
  }) {
    return this.prisma.delivery.create({
      data: {
        store_id: params.storeId,
        device_id: params.deviceId,
        campaign_id: params.campaignId,
        automation_run_id: params.automationRunId,
        status: params.result.success ? 'sent' : 'failed',
        provider: 'onesignal',
        provider_notification_id: params.providerNotificationId,
        payload: params.message as any,
        sent_at: params.result.success ? new Date() : null,
        error: params.result.errors?.join('; '),
      },
    });
  }

  /**
   * Create bulk delivery records
   */
  private async createBulkDeliveries(params: {
    storeId: string;
    deviceIds: string[];
    campaignId?: string;
    message: PushMessage;
    providerNotificationId?: string;
  }) {
    const now = new Date();

    await this.prisma.delivery.createMany({
      data: params.deviceIds.map((deviceId) => ({
        store_id: params.storeId,
        device_id: deviceId,
        campaign_id: params.campaignId,
        status: 'sent' as const,
        provider: 'onesignal',
        provider_notification_id: params.providerNotificationId,
        payload: params.message as any,
        sent_at: now,
      })),
    });
  }

  /**
   * Handle webhook callback from OneSignal
   */
  async handleWebhook(
    event: 'delivered' | 'opened' | 'clicked',
    notificationId: string,
    playerId: string,
  ) {
    // Find the subscription by provider_sub_id
    const subscription = await this.prisma.pushSubscription.findFirst({
      where: { provider_sub_id: playerId },
    });

    if (!subscription) {
      this.logger.warn(`Subscription not found for player ${playerId}`);
      return;
    }

    // Find the delivery record
    const delivery = await this.prisma.delivery.findFirst({
      where: {
        device_id: subscription.device_id,
        provider_notification_id: notificationId,
      },
    });

    if (!delivery) {
      this.logger.warn(`Delivery not found for notification ${notificationId}`);
      return;
    }

    // Update delivery based on event
    const now = new Date();
    const updates: Record<string, any> = {};

    switch (event) {
      case 'delivered':
        updates.status = 'delivered';
        updates.delivered_at = now;
        break;
      case 'opened':
        updates.opened_at = now;
        break;
      case 'clicked':
        updates.clicked_at = now;
        break;
    }

    await this.prisma.delivery.update({
      where: { id: delivery.id },
      data: updates,
    });
  }
}
