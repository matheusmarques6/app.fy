import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QUEUE_NAMES, SEGMENT_REFRESH_BATCH_SIZE } from '@appfy/shared';
import type { SegmentDefinition, SegmentRule } from '@appfy/shared';

interface SegmentRefreshJob {
  storeId: string;
  deviceId: string;
  changedFields: string[];
}

interface SegmentFullRefreshJob {
  segmentId: string;
}

@Processor(QUEUE_NAMES.SEGMENT_REFRESH)
export class SegmentProcessor extends WorkerHost {
  private readonly logger = new Logger(SegmentProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<SegmentRefreshJob>): Promise<void> {
    const { storeId, deviceId, changedFields } = job.data;

    this.logger.debug(`Refreshing segments for device ${deviceId}`);

    try {
      // Get all active segments for this store
      const segments = await this.prisma.segment.findMany({
        where: {
          store_id: storeId,
          // Only evaluate segments that might be affected by changed fields
        },
      });

      // Get device metrics
      const metrics = await this.prisma.userMetrics.findUnique({
        where: { device_id: deviceId },
      });

      const device = await this.prisma.device.findUnique({
        where: { id: deviceId },
      });

      if (!metrics || !device) {
        this.logger.warn(`Device ${deviceId} or metrics not found`);
        return;
      }

      // Evaluate each segment
      for (const segment of segments) {
        const definition = segment.definition as unknown as SegmentDefinition;
        const isMember = this.evaluateSegment(definition, metrics, device);

        // Get current membership
        const membership = await this.prisma.segmentMembership.findUnique({
          where: {
            segment_id_device_id: {
              segment_id: segment.id,
              device_id: deviceId,
            },
          },
        });

        const now = new Date();

        if (isMember && !membership) {
          // Add to segment
          await this.prisma.segmentMembership.create({
            data: {
              segment_id: segment.id,
              device_id: deviceId,
              store_id: storeId,
              entered_at: now,
            },
          });

          // Update member count
          await this.prisma.segment.update({
            where: { id: segment.id },
            data: { member_count: { increment: 1 } },
          });

          this.logger.debug(`Device ${deviceId} entered segment ${segment.name}`);
        } else if (!isMember && membership && !membership.exited_at) {
          // Remove from segment
          await this.prisma.segmentMembership.update({
            where: { id: membership.id },
            data: { exited_at: now },
          });

          // Update member count
          await this.prisma.segment.update({
            where: { id: segment.id },
            data: { member_count: { decrement: 1 } },
          });

          this.logger.debug(`Device ${deviceId} exited segment ${segment.name}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to refresh segments for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Evaluate segment definition against device metrics
   */
  private evaluateSegment(
    definition: SegmentDefinition,
    metrics: any,
    device: any,
  ): boolean {
    const { match, rules } = definition;

    const results = rules.map((rule) => this.evaluateRule(rule, metrics, device));

    if (match === 'all') {
      return results.every(Boolean);
    } else {
      return results.some(Boolean);
    }
  }

  /**
   * Evaluate a single rule
   */
  private evaluateRule(rule: SegmentRule, metrics: any, device: any): boolean {
    const { field, op, value } = rule;

    if (!field) return true;

    // Get the actual value from metrics or device
    const actualValue = this.getFieldValue(field, metrics, device);

    switch (op) {
      case '==':
        return actualValue === value;
      case '!=':
        return actualValue !== value;
      case '>':
        return Number(actualValue) > Number(value);
      case '>=':
        return Number(actualValue) >= Number(value);
      case '<':
        return Number(actualValue) < Number(value);
      case '<=':
        return Number(actualValue) <= Number(value);
      case 'in':
        return Array.isArray(value) && (value as any[]).includes(actualValue);
      case 'not_in':
        return Array.isArray(value) && !(value as any[]).includes(actualValue);
      case 'exists':
        return actualValue !== null && actualValue !== undefined;
      case 'not_exists':
        return actualValue === null || actualValue === undefined;
      case 'within_last':
        return this.isWithinLast(actualValue, value as string);
      case 'contains':
        return String(actualValue).includes(String(value));
      case 'starts_with':
        return String(actualValue).startsWith(String(value));
      default:
        return false;
    }
  }

  private getFieldValue(field: string, metrics: any, device: any): any {
    const [category, key] = field.split('.');

    if (category === 'metrics') {
      return metrics[key];
    } else if (category === 'device') {
      return device[key];
    }

    return null;
  }

  private isWithinLast(date: any, window: string): boolean {
    if (!date) return false;

    const now = new Date();
    const dateValue = new Date(date);
    const diffMs = now.getTime() - dateValue.getTime();

    // Parse window (e.g., "30m", "2h", "7d")
    const match = window.match(/^(\d+)([mhd])$/);
    if (!match) return false;

    const amount = parseInt(match[1], 10);
    const unit = match[2];

    let windowMs: number;
    switch (unit) {
      case 'm':
        windowMs = amount * 60 * 1000;
        break;
      case 'h':
        windowMs = amount * 60 * 60 * 1000;
        break;
      case 'd':
        windowMs = amount * 24 * 60 * 60 * 1000;
        break;
      default:
        return false;
    }

    return diffMs <= windowMs;
  }
}
