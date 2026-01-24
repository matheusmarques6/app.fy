import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PushService } from '../../modules/push/push.service';
import { QUEUE_NAMES } from '@appfy/shared';

interface PushSendJob {
  storeId: string;
  deviceId?: string;
  segmentId?: string;
  campaignId?: string;
  automationId?: string;
  automationRunId?: string;
  templateId: string;
  message: {
    title: string;
    body: string;
    data?: Record<string, any>;
    imageUrl?: string;
    deeplink?: string;
  };
}

@Processor(QUEUE_NAMES.PUSH_SEND)
export class PushProcessor extends WorkerHost {
  private readonly logger = new Logger(PushProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {
    super();
  }

  async process(job: Job<PushSendJob>): Promise<void> {
    const { storeId, deviceId, segmentId, campaignId, automationId, automationRunId, templateId, message } = job.data;

    this.logger.debug(`Processing push job for store ${storeId}`);

    try {
      let result;

      if (deviceId) {
        // Send to specific device
        result = await this.pushService.sendToDevice({
          storeId,
          deviceId,
          campaignId,
          automationId,
          automationRunId,
          templateId,
          message,
        });

        if (result.success) {
          this.logger.debug(`Push sent to device ${deviceId}`);
        } else {
          this.logger.warn(`Push failed for device ${deviceId}: ${result.errors?.join(', ')}`);
        }
      } else if (segmentId) {
        // Send to segment
        result = await this.pushService.sendToSegment({
          storeId,
          segmentId,
          campaignId,
          automationId,
          templateId,
          message,
        });

        this.logger.log(`Push sent to segment ${segmentId}: ${result.recipients} recipients`);
      } else {
        this.logger.error('No deviceId or segmentId provided');
        return;
      }

      // Update campaign status if applicable
      if (campaignId && result.success) {
        await this.prisma.campaign.update({
          where: { id: campaignId },
          data: {
            status: 'sent',
            sent_at: new Date(),
          },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to process push job:`, error);
      throw error;
    }
  }
}
