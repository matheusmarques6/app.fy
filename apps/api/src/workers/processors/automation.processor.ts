import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QUEUE_NAMES } from '@appfy/shared';

interface AutomationTriggerJob {
  storeId: string;
  deviceId: string;
  eventName: string;
  eventProps: Record<string, unknown>;
}

interface AutomationStepJob {
  automationRunId: string;
  nodeId: string;
}

@Processor(QUEUE_NAMES.AUTOMATION_EVAL)
export class AutomationProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.PUSH_SEND)
    private readonly pushQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<AutomationTriggerJob | AutomationStepJob>): Promise<void> {
    if (job.name === 'check-trigger') {
      await this.handleTrigger(job.data as AutomationTriggerJob);
    } else if (job.name === 'execute-step') {
      await this.handleStep(job.data as AutomationStepJob);
    }
  }

  /**
   * Check if event triggers any automations
   */
  private async handleTrigger(data: AutomationTriggerJob): Promise<void> {
    const { storeId, deviceId, eventName } = data;

    this.logger.debug(`Checking automation triggers for event ${eventName}`);

    // Find active automations triggered by this event
    const automations = await this.prisma.automation.findMany({
      where: {
        store_id: storeId,
        status: 'active',
        entry_event: eventName,
      },
    });

    for (const automation of automations) {
      // Check if device already has an active run for this automation
      const existingRun = await this.prisma.automationRun.findFirst({
        where: {
          automation_id: automation.id,
          device_id: deviceId,
          status: { in: ['running', 'waiting'] },
        },
      });

      if (existingRun) {
        this.logger.debug(
          `Device ${deviceId} already has active run for automation ${automation.id}`,
        );
        continue;
      }

      // Check entry segment if defined
      if (automation.entry_segment_id) {
        const membership = await this.prisma.segmentMembership.findFirst({
          where: {
            segment_id: automation.entry_segment_id,
            device_id: deviceId,
            exited_at: null,
          },
        });

        if (!membership) {
          continue; // Device not in required segment
        }
      }

      // Create automation run
      const run = await this.prisma.automationRun.create({
        data: {
          automation_id: automation.id,
          device_id: deviceId,
          store_id: storeId,
          status: 'running',
          current_node_id: this.getFirstNodeId(automation.nodes as any[]),
        },
      });

      this.logger.log(
        `Started automation run ${run.id} for device ${deviceId}`,
      );

      // Execute first step
      await this.executeNode(run.id, run.current_node_id!);
    }
  }

  /**
   * Execute a specific automation step
   */
  private async handleStep(data: AutomationStepJob): Promise<void> {
    await this.executeNode(data.automationRunId, data.nodeId);
  }

  /**
   * Execute an automation node
   */
  private async executeNode(runId: string, nodeId: string): Promise<void> {
    const run = await this.prisma.automationRun.findUnique({
      where: { id: runId },
      include: { automation: true },
    });

    if (!run || run.status !== 'running') {
      return;
    }

    const nodes = run.automation.nodes as any[];
    const edges = run.automation.edges as any[];
    const node = nodes.find((n) => n.id === nodeId);

    if (!node) {
      this.logger.error(`Node ${nodeId} not found in automation`);
      return;
    }

    this.logger.debug(`Executing node ${nodeId} (${node.type}) for run ${runId}`);

    switch (node.type) {
      case 'trigger':
        // Trigger nodes just pass through
        await this.moveToNextNode(run, node, edges, 'true');
        break;

      case 'condition':
        const conditionResult = await this.evaluateCondition(run, node.data);
        await this.moveToNextNode(run, node, edges, conditionResult ? 'true' : 'false');
        break;

      case 'delay':
        const delayMs = this.parseDelay(node.data.duration);
        await this.prisma.automationRun.update({
          where: { id: runId },
          data: { status: 'waiting' },
        });

        // Schedule next step
        await this.prisma.scheduledJob.create({
          data: {
            store_id: run.store_id,
            job_type: 'automation_step',
            reference_id: runId,
            reference_type: 'automation_run',
            scheduled_for: new Date(Date.now() + delayMs),
            payload: { nodeId: this.getNextNodeId(node, edges, 'true') },
          },
        });
        break;

      case 'action':
        await this.executeAction(run, node.data);
        await this.moveToNextNode(run, node, edges, 'true');
        break;
    }
  }

  private async moveToNextNode(
    run: any,
    currentNode: any,
    edges: any[],
    conditionKey: string,
  ): Promise<void> {
    const nextNodeId = this.getNextNodeId(currentNode, edges, conditionKey);

    if (!nextNodeId) {
      // End of automation
      await this.prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          completed_at: new Date(),
        },
      });
      this.logger.log(`Automation run ${run.id} completed`);
      return;
    }

    await this.prisma.automationRun.update({
      where: { id: run.id },
      data: { current_node_id: nextNodeId },
    });

    // Execute next node immediately
    await this.executeNode(run.id, nextNodeId);
  }

  private getFirstNodeId(nodes: any[]): string | null {
    const triggerNode = nodes.find((n) => n.type === 'trigger');
    return triggerNode?.id || null;
  }

  private getNextNodeId(currentNode: any, edges: any[], conditionKey: string): string | null {
    const edge = edges.find(
      (e) =>
        e.source_node_id === currentNode.id &&
        (e.condition_key === conditionKey || !e.condition_key),
    );
    return edge?.target_node_id || null;
  }

  private async evaluateCondition(run: any, conditionData: any): Promise<boolean> {
    // Get device metrics for evaluation
    const metrics = await this.prisma.userMetrics.findUnique({
      where: { device_id: run.device_id },
    });

    // Simple evaluation - could be expanded with full DSL
    if (!metrics) return false;

    // Check if device has made a purchase (common condition)
    if (conditionData.check === 'no_purchase') {
      return metrics.purchases_7d === 0;
    }

    return true;
  }

  private async executeAction(run: any, actionData: any): Promise<void> {
    if (actionData.action_type === 'send_push') {
      // Get device's push subscription
      const subscription = await this.prisma.pushSubscription.findFirst({
        where: {
          device_id: run.device_id,
          opt_in: true,
        },
      });

      if (subscription) {
        await this.pushQueue.add('send', {
          storeId: run.store_id,
          deviceId: run.device_id,
          automationId: run.automation_id,
          automationRunId: run.id,
          templateId: actionData.config.template_id,
          providerSubId: subscription.provider_sub_id,
        });
      }
    }
  }

  private parseDelay(duration: string): number {
    const match = duration.match(/^(\d+)([mhd])$/);
    if (!match) return 0;

    const amount = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'm':
        return amount * 60 * 1000;
      case 'h':
        return amount * 60 * 60 * 1000;
      case 'd':
        return amount * 24 * 60 * 60 * 1000;
      default:
        return 0;
    }
  }
}
