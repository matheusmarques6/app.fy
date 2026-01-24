// @ts-nocheck
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AutomationNode, AutomationEdge } from '@appfy/shared';

interface CreateAutomationDto {
  name: string;
  description?: string;
  entry_event: string;
  entry_segment_id?: string;
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  status?: 'draft' | 'active' | 'paused' | 'archived';
}

interface UpdateAutomationDto {
  name?: string;
  description?: string;
  entry_event?: string;
  entry_segment_id?: string;
  nodes?: AutomationNode[];
  edges?: AutomationEdge[];
  status?: 'draft' | 'active' | 'paused' | 'archived';
}

@Injectable()
export class AutomationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(storeId: string) {
    return this.prisma.automation.findMany({
      where: { store_id: storeId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        entry_event: true,
        entry_segment_id: true,
        status: true,
        nodes: true,
        edges: true,
        stats: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: {
            runs: true,
          },
        },
      },
    });
  }

  async findOne(storeId: string, automationId: string) {
    const automation = await this.prisma.automation.findUnique({
      where: { id: automationId },
      include: {
        entry_segment: true,
        _count: {
          select: {
            runs: true,
          },
        },
      },
    });

    if (!automation) {
      throw new NotFoundException('Automation not found');
    }

    if (automation.store_id !== storeId) {
      throw new ForbiddenException('Access denied');
    }

    return automation;
  }

  async create(storeId: string, dto: CreateAutomationDto) {
    // Validate flow structure
    this.validateFlow(dto.nodes, dto.edges);

    return this.prisma.automation.create({
      data: {
        store_id: storeId,
        name: dto.name,
        description: dto.description,
        entry_event: dto.entry_event,
        entry_segment_id: dto.entry_segment_id,
        nodes: dto.nodes as any,
        edges: dto.edges as any,
        status: dto.status ?? 'draft',
        stats: {},
      },
    });
  }

  async update(storeId: string, automationId: string, dto: UpdateAutomationDto) {
    await this.findOne(storeId, automationId);

    if (dto.nodes && dto.edges) {
      this.validateFlow(dto.nodes, dto.edges);
    }

    return this.prisma.automation.update({
      where: { id: automationId },
      data: {
        name: dto.name,
        description: dto.description,
        entry_event: dto.entry_event,
        entry_segment_id: dto.entry_segment_id,
        nodes: dto.nodes as any,
        edges: dto.edges as any,
        status: dto.status,
        updated_at: new Date(),
      },
    });
  }

  async delete(storeId: string, automationId: string) {
    await this.findOne(storeId, automationId);

    // Delete runs first
    await this.prisma.automationRun.deleteMany({
      where: { automation_id: automationId },
    });

    return this.prisma.automation.delete({
      where: { id: automationId },
    });
  }

  async toggleActive(storeId: string, automationId: string, isActive: boolean) {
    await this.findOne(storeId, automationId);

    return this.prisma.automation.update({
      where: { id: automationId },
      data: {
        status: isActive ? 'active' : 'paused',
        updated_at: new Date(),
      },
    });
  }

  async getRuns(storeId: string, automationId: string, page = 1, limit = 50) {
    await this.findOne(storeId, automationId);

    const skip = (page - 1) * limit;

    const [runs, total] = await Promise.all([
      this.prisma.automationRun.findMany({
        where: { automation_id: automationId },
        include: {
          device: {
            select: {
              id: true,
              platform: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { started_at: 'desc' },
      }),
      this.prisma.automationRun.count({
        where: { automation_id: automationId },
      }),
    ]);

    return {
      data: runs,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async getStats(storeId: string, automationId: string) {
    await this.findOne(storeId, automationId);

    const [totalRuns, completedRuns, failedRuns] = await Promise.all([
      this.prisma.automationRun.count({
        where: { automation_id: automationId },
      }),
      this.prisma.automationRun.count({
        where: {
          automation_id: automationId,
          status: 'completed',
        },
      }),
      this.prisma.automationRun.count({
        where: {
          automation_id: automationId,
          status: 'exited',
        },
      }),
    ]);

    return {
      total_runs: totalRuns,
      completed_runs: completedRuns,
      failed_runs: failedRuns,
      success_rate: totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 0,
    };
  }

  private validateFlow(nodes: AutomationNode[], edges: AutomationEdge[]) {
    if (!nodes || !Array.isArray(nodes)) {
      throw new BadRequestException('Invalid flow: nodes must be an array');
    }

    if (!edges || !Array.isArray(edges)) {
      throw new BadRequestException('Invalid flow: edges must be an array');
    }

    // Check for trigger node
    const triggerNode = nodes.find((n) => n.type === 'trigger');
    if (!triggerNode) {
      throw new BadRequestException('Invalid flow: must have a trigger node');
    }

    // Validate node types
    const validNodeTypes = ['trigger', 'condition', 'delay', 'action', 'segment_check'];
    for (const node of nodes) {
      if (!validNodeTypes.includes(node.type)) {
        throw new BadRequestException(`Invalid node type: ${node.type}`);
      }
    }

    // Validate edges reference existing nodes
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const edge of edges) {
      if (!nodeIds.has(edge.source_node_id)) {
        throw new BadRequestException(`Invalid edge: source node ${edge.source_node_id} not found`);
      }
      if (!nodeIds.has(edge.target_node_id)) {
        throw new BadRequestException(`Invalid edge: target node ${edge.target_node_id} not found`);
      }
    }
  }
}
