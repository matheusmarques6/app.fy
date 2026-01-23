import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { QUEUE_NAMES, PUSH_MAX_PER_DEVICE_PER_DAY } from '@appfy/shared';

interface PushSendJob {
  storeId: string;
  deviceId: string;
  campaignId?: string;
  automationId?: string;
  automationRunId?: string;
  templateId: string;
  providerSubId: string;
}

@Processor(QUEUE_NAMES.PUSH_SEND)
export class PushProcessor extends WorkerHost {
  private readonly logger = new Logger(PushProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job<PushSendJob>): Promise<void> {
    const { storeId, deviceId, templateId, providerSubId } = job.data;

    this.logger.debug(`Sending push to device ${deviceId}`);

    try {
      // Check rate limit per device
      const rateLimitKey = `push:device:${deviceId}:daily`;
      const { allowed, remaining } = await this.redis.checkRateLimit(
        rateLimitKey,
        PUSH_MAX_PER_DEVICE_PER_DAY,
        86400, // 24 hours
      );

      if (!allowed) {
        this.logger.warn(`Device ${deviceId} exceeded daily push limit`);
        return;
      }

      // Get template
      const template = await this.prisma.pushTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        this.logger.error(`Template ${templateId} not found`);
        return;
      }

      // Get device for locale
      const device = await this.prisma.device.findUnique({
        where: { id: deviceId },
      });

      if (!device) {
        return;
      }

      // Get localized content
      const locale = device.locale || 'pt-BR';
      const title = (template.title as any)[locale] || (template.title as any)['pt-BR'] || '';
      const body = (template.body as any)[locale] || (template.body as any)['pt-BR'] || '';

      // Create delivery record
      const delivery = await this.prisma.delivery.create({
        data: {
          store_id: storeId,
          device_id: deviceId,
          campaign_id: job.data.campaignId,
          automation_id: job.data.automationId,
          automation_run_id: job.data.automationRunId,
          template_id: templateId,
          status: 'pending',
          scheduled_for: new Date(),
        },
      });

      // Send via OneSignal (mock for now - implement actual provider)
      const result = await this.sendViaOneSignal({
        providerSubId,
        title,
        body,
        imageUrl: template.image_url || undefined,
        deeplink: template.deeplink || undefined,
        data: {
          delivery_id: delivery.id,
          campaign_id: job.data.campaignId,
          ...(template.data as any),
        },
      });

      // Update delivery status
      await this.prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          status: result.success ? 'sent' : 'failed',
          sent_at: result.success ? new Date() : undefined,
          failed_at: !result.success ? new Date() : undefined,
          failure_reason: result.error,
          provider_message_id: result.messageId,
        },
      });

      if (result.success) {
        this.logger.debug(`Push sent to device ${deviceId}, delivery ${delivery.id}`);
      } else {
        this.logger.error(`Push failed for device ${deviceId}: ${result.error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send push to device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Send push via OneSignal
   * TODO: Implement actual OneSignal API integration
   */
  private async sendViaOneSignal(params: {
    providerSubId: string;
    title: string;
    body: string;
    imageUrl?: string;
    deeplink?: string;
    data?: Record<string, any>;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const oneSignalAppId = process.env.ONESIGNAL_APP_ID;
    const oneSignalApiKey = process.env.ONESIGNAL_API_KEY;

    if (!oneSignalAppId || !oneSignalApiKey) {
      this.logger.warn('OneSignal credentials not configured');
      return { success: false, error: 'OneSignal not configured' };
    }

    try {
      const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${oneSignalApiKey}`,
        },
        body: JSON.stringify({
          app_id: oneSignalAppId,
          include_player_ids: [params.providerSubId],
          headings: { en: params.title },
          contents: { en: params.body },
          big_picture: params.imageUrl,
          url: params.deeplink,
          data: params.data,
        }),
      });

      const result = await response.json();

      if (result.id) {
        return { success: true, messageId: result.id };
      } else {
        return { success: false, error: result.errors?.[0] || 'Unknown error' };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
