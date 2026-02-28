import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QUEUE_NAMES, SEGMENT_REFRESH_BATCH_SIZE } from '@appfy/shared';
import type { SegmentDefinition, SegmentRule } from '@appfy/shared';

interface SegmentFullRefreshJob {
  segmentId: string;
}

@Processor(QUEUE_NAMES.SEGMENT_FULL_REFRESH)
export class SegmentFullRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(SegmentFullRefreshProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<SegmentFullRefreshJob>): Promise<void> {
    const { segmentId } = job.data;

    this.logger.log(`Full refresh for segment ${segmentId}`);

    const segment = await this.prisma.segment.findUnique({
      where: { id: segmentId },
    });

    if (!segment) {
      this.logger.warn(`Segment ${segmentId} not found`);
      return;
    }

    const definition = segment.definition as unknown as SegmentDefinition;
    let memberCount = 0;

    // Process in batches to avoid memory issues
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const devices = await this.prisma.device.findMany({
        where: { store_id: segment.store_id },
        include: { user_metrics: true },
        take: SEGMENT_REFRESH_BATCH_SIZE,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        orderBy: { id: 'asc' },
      });

      if (devices.length === 0) {
        hasMore = false;
        break;
      }

      cursor = devices[devices.length - 1].id;
      hasMore = devices.length === SEGMENT_REFRESH_BATCH_SIZE;

      for (const device of devices) {
        const isMember = device.user_metrics
          ? this.evaluateSegment(definition, device.user_metrics, device)
          : false;

        const membership = await this.prisma.segmentMembership.findUnique({
          where: {
            segment_id_device_id: {
              segment_id: segmentId,
              device_id: device.id,
            },
          },
        });

        const now = new Date();

        if (isMember && !membership) {
          await this.prisma.segmentMembership.create({
            data: {
              segment_id: segmentId,
              device_id: device.id,
              store_id: segment.store_id,
              entered_at: now,
            },
          });
          memberCount++;
        } else if (isMember && membership && membership.exited_at) {
          await this.prisma.segmentMembership.update({
            where: { id: membership.id },
            data: { exited_at: null, entered_at: now },
          });
          memberCount++;
        } else if (!isMember && membership && !membership.exited_at) {
          await this.prisma.segmentMembership.update({
            where: { id: membership.id },
            data: { exited_at: now },
          });
        } else if (isMember && membership && !membership.exited_at) {
          memberCount++;
        }
      }
    }

    // Update member_count and last_evaluated_at
    await this.prisma.segment.update({
      where: { id: segmentId },
      data: {
        member_count: memberCount,
        last_evaluated_at: new Date(),
      },
    });

    this.logger.log(`Segment ${segmentId} full refresh done: ${memberCount} members`);
  }

  private evaluateSegment(
    definition: SegmentDefinition,
    metrics: any,
    device: any,
  ): boolean {
    const { match, rules } = definition;
    const results = rules.map((rule) => this.evaluateRule(rule, metrics, device));
    return match === 'all' ? results.every(Boolean) : results.some(Boolean);
  }

  private evaluateRule(rule: SegmentRule, metrics: any, device: any): boolean {
    const { field, op, value } = rule;
    if (!field) return true;

    const actualValue = this.getFieldValue(field, metrics, device);

    switch (op) {
      case '==': return actualValue === value;
      case '!=': return actualValue !== value;
      case '>': return Number(actualValue) > Number(value);
      case '>=': return Number(actualValue) >= Number(value);
      case '<': return Number(actualValue) < Number(value);
      case '<=': return Number(actualValue) <= Number(value);
      case 'in': return Array.isArray(value) && (value as any[]).includes(actualValue);
      case 'not_in': return Array.isArray(value) && !(value as any[]).includes(actualValue);
      case 'exists': return actualValue !== null && actualValue !== undefined;
      case 'not_exists': return actualValue === null || actualValue === undefined;
      case 'within_last': return this.isWithinLast(actualValue, value as string);
      case 'contains': return String(actualValue).includes(String(value));
      case 'starts_with': return String(actualValue).startsWith(String(value));
      default: return false;
    }
  }

  private getFieldValue(field: string, metrics: any, device: any): any {
    const [category, key] = field.split('.');
    if (category === 'metrics') return metrics[key];
    if (category === 'device') return device[key];
    return null;
  }

  private isWithinLast(date: any, window: string): boolean {
    if (!date) return false;
    const diffMs = Date.now() - new Date(date).getTime();
    const match = window.match(/^(\d+)([mhd])$/);
    if (!match) return false;
    const amount = parseInt(match[1], 10);
    const multipliers: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };
    return diffMs <= amount * (multipliers[match[2]] ?? 0);
  }
}
