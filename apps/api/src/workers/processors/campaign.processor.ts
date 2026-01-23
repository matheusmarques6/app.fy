import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QUEUE_NAMES } from '@appfy/shared';

interface CampaignSendJob {
  campaignId: string;
}

@Processor(QUEUE_NAMES.CAMPAIGN_SEND)
export class CampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.PUSH_SEND)
    private readonly pushQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<CampaignSendJob>): Promise<void> {
    const { campaignId } = job.data;

    this.logger.log(`Processing campaign ${campaignId}`);

    try {
      // Get campaign
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { segment: true },
      });

      if (!campaign) {
        this.logger.error(`Campaign ${campaignId} not found`);
        return;
      }

      if (campaign.status !== 'scheduled') {
        this.logger.warn(`Campaign ${campaignId} is not in scheduled status`);
        return;
      }

      // Update status to sending
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'sending' },
      });

      // Get target devices
      let devices: any[];

      if (campaign.segment_id) {
        // Get devices in segment
        const memberships = await this.prisma.segmentMembership.findMany({
          where: {
            segment_id: campaign.segment_id,
            exited_at: null,
          },
          include: {
            device: {
              include: {
                push_subscriptions: {
                  where: { opt_in: true },
                },
              },
            },
          },
        });

        devices = memberships
          .map((m) => m.device)
          .filter((d) => d.push_subscriptions.length > 0);
      } else {
        // All opted-in devices
        devices = await this.prisma.device.findMany({
          where: {
            store_id: campaign.store_id,
            push_subscriptions: {
              some: { opt_in: true },
            },
          },
          include: {
            push_subscriptions: {
              where: { opt_in: true },
            },
          },
        });
      }

      this.logger.log(`Campaign ${campaignId} targeting ${devices.length} devices`);

      // Queue push for each device
      let queued = 0;
      for (const device of devices) {
        const subscription = device.push_subscriptions[0];
        if (!subscription) continue;

        await this.pushQueue.add('send', {
          storeId: campaign.store_id,
          deviceId: device.id,
          campaignId: campaign.id,
          templateId: campaign.template_id,
          providerSubId: subscription.provider_sub_id,
        });

        queued++;
      }

      // Update campaign stats
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'sent',
          sent_at: new Date(),
          stats: {
            ...((campaign.stats as any) || {}),
            total_targeted: devices.length,
            total_sent: queued,
          },
        },
      });

      this.logger.log(`Campaign ${campaignId} sent to ${queued} devices`);
    } catch (error) {
      this.logger.error(`Failed to process campaign ${campaignId}:`, error);

      // Mark as failed
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'draft' }, // Reset to draft on failure
      });

      throw error;
    }
  }
}
