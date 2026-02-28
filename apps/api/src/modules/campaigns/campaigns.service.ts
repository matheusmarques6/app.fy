// @ts-nocheck
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@appfy/shared';

interface CreateCampaignDto {
  name: string;
  description?: string;
  type?: 'one_time' | 'recurring' | 'triggered';
  segment_id?: string;
  timezone?: string;
  // Template content
  template_name?: string;
  title: Record<string, string>; // { "pt-BR": "...", "en-US": "..." }
  body: Record<string, string>;
  image_url?: string;
  deeplink?: string;
  data?: Record<string, any>;
}

interface UpdateCampaignDto {
  name?: string;
  description?: string;
  segment_id?: string;
  timezone?: string;
  // Template content
  title?: Record<string, string>;
  body?: Record<string, string>;
  image_url?: string;
  deeplink?: string;
  data?: Record<string, any>;
}

type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.CAMPAIGN_SEND) private readonly campaignQueue: Queue,
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
        description: true,
        type: true,
        status: true,
        scheduled_for: true,
        timezone: true,
        stats: true,
        sent_at: true,
        created_at: true,
        updated_at: true,
        segment: {
          select: {
            id: true,
            name: true,
            member_count: true,
          },
        },
        template: {
          select: {
            id: true,
            name: true,
            title: true,
            body: true,
            image_url: true,
            deeplink: true,
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
        template: true,
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

    // Create template and campaign in a transaction
    return this.prisma.$transaction(async (tx) => {
      // Create the push template first
      const template = await tx.pushTemplate.create({
        data: {
          store_id: storeId,
          name: dto.template_name || `Template for ${dto.name}`,
          title: dto.title,
          body: dto.body,
          image_url: dto.image_url,
          deeplink: dto.deeplink,
          data: dto.data || {},
        },
      });

      // Create the campaign
      const campaign = await tx.campaign.create({
        data: {
          store_id: storeId,
          name: dto.name,
          description: dto.description,
          type: dto.type || 'one_time',
          segment_id: dto.segment_id,
          template_id: template.id,
          timezone: dto.timezone || 'America/Sao_Paulo',
          status: 'draft',
          stats: {},
        },
        include: {
          template: true,
          segment: true,
        },
      });

      return campaign;
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

    // Update template and campaign
    return this.prisma.$transaction(async (tx) => {
      // Update the template if any template fields are provided
      if (dto.title || dto.body || dto.image_url !== undefined || dto.deeplink !== undefined || dto.data) {
        await tx.pushTemplate.update({
          where: { id: campaign.template_id },
          data: {
            ...(dto.title && { title: dto.title }),
            ...(dto.body && { body: dto.body }),
            ...(dto.image_url !== undefined && { image_url: dto.image_url }),
            ...(dto.deeplink !== undefined && { deeplink: dto.deeplink }),
            ...(dto.data && { data: dto.data }),
            updated_at: new Date(),
          },
        });
      }

      // Update the campaign
      return tx.campaign.update({
        where: { id: campaignId },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.segment_id !== undefined && { segment_id: dto.segment_id }),
          ...(dto.timezone && { timezone: dto.timezone }),
          updated_at: new Date(),
        },
        include: {
          template: true,
          segment: true,
        },
      });
    });
  }

  async delete(storeId: string, campaignId: string) {
    const campaign = await this.findOne(storeId, campaignId);

    if (!['draft', 'cancelled'].includes(campaign.status)) {
      throw new BadRequestException('Can only delete draft or cancelled campaigns');
    }

    // Delete campaign (template can be kept for historical purposes)
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

    // Mark as scheduled so the processor can pick it up and transition to sending → sent
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'scheduled',
        scheduled_for: new Date(),
        updated_at: new Date(),
      },
    });

    // Queue for immediate sending (no delay)
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

    // Duplicate both template and campaign
    return this.prisma.$transaction(async (tx) => {
      // Duplicate the template
      const newTemplate = await tx.pushTemplate.create({
        data: {
          store_id: storeId,
          name: `${campaign.template.name} (Copy)`,
          title: campaign.template.title as any,
          body: campaign.template.body as any,
          image_url: campaign.template.image_url,
          deeplink: campaign.template.deeplink,
          data: campaign.template.data as any || {},
        },
      });

      // Duplicate the campaign
      return tx.campaign.create({
        data: {
          store_id: storeId,
          name: `${campaign.name} (Copy)`,
          description: campaign.description,
          type: campaign.type,
          segment_id: campaign.segment_id,
          template_id: newTemplate.id,
          timezone: campaign.timezone,
          status: 'draft',
          stats: {},
        },
        include: {
          template: true,
          segment: true,
        },
      });
    });
  }
}
