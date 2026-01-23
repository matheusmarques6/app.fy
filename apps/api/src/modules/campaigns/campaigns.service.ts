// @ts-nocheck
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@appfy/shared';

interface CreateCampaignDto {
  name: string;
  segment_id?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  image_url?: string;
  action_url?: string;
}

interface UpdateCampaignDto {
  name?: string;
  segment_id?: string;
  title?: string;
  body?: string;
  data?: Record<string, any>;
  image_url?: string;
  action_url?: string;
}

type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.CAMPAIGN_SCHEDULER) private readonly campaignQueue: Queue,
  ) {}

  async findAll(storeId: string, status?: CampaignStatus) {
    return this.prisma.campaign.findMany({
      where: {
        store_id: storeId,
        ...(status && { status }),
      },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        title: true,
        body: true,
        scheduled_for: true,
        sent_at: true,
        created_at: true,
        segment: {
          select: {
            id: true,
            name: true,
            member_count: true,
          },
        },
        _count: {
          select: {
            deliveries: true,
          },
        },
      },
    });
  }

  async findOne(storeId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        segment: {
          select: {
            id: true,
            name: true,
            member_count: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.store_id !== storeId) {
      throw new ForbiddenException('Access denied');
    }

    return campaign;
  }

  async create(storeId: string, dto: CreateCampaignDto) {
    // Validate segment exists if provided
    if (dto.segment_id) {
      const segment = await this.prisma.segment.findUnique({
        where: { id: dto.segment_id },
      });
      if (!segment || segment.store_id !== storeId) {
        throw new BadRequestException('Invalid segment');
      }
    }

    return this.prisma.campaign.create({
      data: {
        store_id: storeId,
        name: dto.name,
        segment_id: dto.segment_id,
        title: dto.title,
        body: dto.body,
        data: dto.data || {},
        image_url: dto.image_url,
        action_url: dto.action_url,
        status: 'draft',
      },
    });
  }

  async update(storeId: string, campaignId: string, dto: UpdateCampaignDto) {
    const campaign = await this.findOne(storeId, campaignId);

    if (campaign.status !== 'draft') {
      throw new BadRequestException('Can only edit draft campaigns');
    }

    // Validate segment if provided
    if (dto.segment_id) {
      const segment = await this.prisma.segment.findUnique({
        where: { id: dto.segment_id },
      });
      if (!segment || segment.store_id !== storeId) {
        throw new BadRequestException('Invalid segment');
      }
    }

    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        name: dto.name,
        segment_id: dto.segment_id,
        title: dto.title,
        body: dto.body,
        data: dto.data,
        image_url: dto.image_url,
        action_url: dto.action_url,
        updated_at: new Date(),
      },
    });
  }

  async delete(storeId: string, campaignId: string) {
    const campaign = await this.findOne(storeId, campaignId);

    if (!['draft', 'cancelled'].includes(campaign.status)) {
      throw new BadRequestException('Can only delete draft or cancelled campaigns');
    }

    return this.prisma.campaign.delete({
      where: { id: campaignId },
    });
  }

  async schedule(storeId: string, campaignId: string, scheduledFor: Date) {
    const campaign = await this.findOne(storeId, campaignId);

    if (campaign.status !== 'draft') {
      throw new BadRequestException('Can only schedule draft campaigns');
    }

    if (scheduledFor <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    // Update campaign status
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'scheduled',
        scheduled_for: scheduledFor,
        updated_at: new Date(),
      },
    });

    // Queue the campaign for sending
    const delay = scheduledFor.getTime() - Date.now();
    await this.campaignQueue.add(
      'send',
      { campaignId, storeId },
      { delay, jobId: `campaign-${campaignId}` },
    );

    return this.findOne(storeId, campaignId);
  }

  async sendNow(storeId: string, campaignId: string) {
    const campaign = await this.findOne(storeId, campaignId);

    if (!['draft', 'scheduled'].includes(campaign.status)) {
      throw new BadRequestException('Can only send draft or scheduled campaigns');
    }

    // Update campaign status
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'sending',
        updated_at: new Date(),
      },
    });

    // Queue for immediate sending
    await this.campaignQueue.add(
      'send',
      { campaignId, storeId },
      { jobId: `campaign-${campaignId}` },
    );

    return this.findOne(storeId, campaignId);
  }

  async cancel(storeId: string, campaignId: string) {
    const campaign = await this.findOne(storeId, campaignId);

    if (campaign.status !== 'scheduled') {
      throw new BadRequestException('Can only cancel scheduled campaigns');
    }

    // Remove from queue
    const job = await this.campaignQueue.getJob(`campaign-${campaignId}`);
    if (job) {
      await job.remove();
    }

    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'cancelled',
        updated_at: new Date(),
      },
    });
  }

  async getStats(storeId: string, campaignId: string) {
    await this.findOne(storeId, campaignId);

    const [total, sent, delivered, opened, clicked, failed] = await Promise.all([
      this.prisma.delivery.count({ where: { campaign_id: campaignId } }),
      this.prisma.delivery.count({ where: { campaign_id: campaignId, status: 'sent' } }),
      this.prisma.delivery.count({ where: { campaign_id: campaignId, status: 'delivered' } }),
      this.prisma.delivery.count({ where: { campaign_id: campaignId, opened_at: { not: null } } }),
      this.prisma.delivery.count({ where: { campaign_id: campaignId, clicked_at: { not: null } } }),
      this.prisma.delivery.count({ where: { campaign_id: campaignId, status: 'failed' } }),
    ]);

    return {
      total,
      sent,
      delivered,
      opened,
      clicked,
      failed,
      open_rate: delivered > 0 ? (opened / delivered) * 100 : 0,
      click_rate: opened > 0 ? (clicked / opened) * 100 : 0,
    };
  }

  async duplicate(storeId: string, campaignId: string) {
    const campaign = await this.findOne(storeId, campaignId);

    return this.prisma.campaign.create({
      data: {
        store_id: storeId,
        name: `${campaign.name} (Copy)`,
        segment_id: campaign.segment_id,
        title: campaign.title,
        body: campaign.body,
        data: campaign.data || {},
        image_url: campaign.image_url,
        action_url: campaign.action_url,
        status: 'draft',
      },
    });
  }
}
