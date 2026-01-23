// @ts-nocheck
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { SegmentDefinition, SegmentRule } from '@appfy/shared';

interface CreateSegmentDto {
  name: string;
  description?: string;
  definition: SegmentDefinition;
}

interface UpdateSegmentDto {
  name?: string;
  description?: string;
  definition?: SegmentDefinition;
}

@Injectable()
export class SegmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(storeId: string) {
    return this.prisma.segment.findMany({
      where: { store_id: storeId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        member_count: true,
        definition: true,
        created_at: true,
        updated_at: true,
      },
    });
  }

  async findOne(storeId: string, segmentId: string) {
    const segment = await this.prisma.segment.findUnique({
      where: { id: segmentId },
      include: {
        _count: {
          select: {
            memberships: {
              where: { exited_at: null },
            },
          },
        },
      },
    });

    if (!segment) {
      throw new NotFoundException('Segment not found');
    }

    if (segment.store_id !== storeId) {
      throw new ForbiddenException('Access denied');
    }

    return segment;
  }

  async create(storeId: string, dto: CreateSegmentDto) {
    // Validate definition structure
    this.validateDefinition(dto.definition);

    const segment = await this.prisma.segment.create({
      data: {
        store_id: storeId,
        name: dto.name,
        description: dto.description,
        definition: dto.definition as any,
        member_count: 0,
      },
    });

    // Trigger async membership evaluation
    // This would queue a job to evaluate all devices against the new segment
    // await this.queueService.add(QUEUE_NAMES.SEGMENT_FULL_REFRESH, { segmentId: segment.id });

    return segment;
  }

  async update(storeId: string, segmentId: string, dto: UpdateSegmentDto) {
    const segment = await this.findOne(storeId, segmentId);

    if (dto.definition) {
      this.validateDefinition(dto.definition);
    }

    return this.prisma.segment.update({
      where: { id: segmentId },
      data: {
        name: dto.name,
        description: dto.description,
        definition: dto.definition as any,
        updated_at: new Date(),
      },
    });
  }

  async delete(storeId: string, segmentId: string) {
    await this.findOne(storeId, segmentId);

    // Delete memberships first
    await this.prisma.segmentMembership.deleteMany({
      where: { segment_id: segmentId },
    });

    return this.prisma.segment.delete({
      where: { id: segmentId },
    });
  }

  async getMembers(storeId: string, segmentId: string, page = 1, limit = 50) {
    await this.findOne(storeId, segmentId);

    const skip = (page - 1) * limit;

    const [members, total] = await Promise.all([
      this.prisma.segmentMembership.findMany({
        where: {
          segment_id: segmentId,
          exited_at: null,
        },
        include: {
          device: {
            select: {
              id: true,
              platform: true,
              app_version: true,
              last_seen_at: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { entered_at: 'desc' },
      }),
      this.prisma.segmentMembership.count({
        where: {
          segment_id: segmentId,
          exited_at: null,
        },
      }),
    ]);

    return {
      data: members,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async previewCount(storeId: string, definition: SegmentDefinition) {
    this.validateDefinition(definition);

    // Get all devices with metrics for this store
    const devices = await this.prisma.device.findMany({
      where: { store_id: storeId },
      include: {
        metrics: true,
      },
    });

    // Evaluate each device against the definition
    let count = 0;
    for (const device of devices) {
      if (device.metrics && this.evaluateSegment(definition, device.metrics, device)) {
        count++;
      }
    }

    return { estimated_count: count };
  }

  private validateDefinition(definition: SegmentDefinition) {
    if (!definition.match || !['all', 'any'].includes(definition.match)) {
      throw new Error('Invalid segment definition: match must be "all" or "any"');
    }

    if (!Array.isArray(definition.rules) || definition.rules.length === 0) {
      throw new Error('Invalid segment definition: rules must be a non-empty array');
    }

    const validOps = ['==', '!=', '>', '>=', '<', '<=', 'in', 'not_in', 'exists', 'not_exists', 'within_last', 'contains', 'starts_with'];

    for (const rule of definition.rules) {
      if (!rule.field) {
        throw new Error('Invalid rule: field is required');
      }
      if (!validOps.includes(rule.op)) {
        throw new Error(`Invalid rule: op must be one of ${validOps.join(', ')}`);
      }
    }
  }

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

  private evaluateRule(rule: SegmentRule, metrics: any, device: any): boolean {
    const { field, op, value } = rule;

    if (!field) return true;

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
