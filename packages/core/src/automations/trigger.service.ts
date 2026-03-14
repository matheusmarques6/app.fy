/**
 * Automation Trigger Service — processes events and creates BullMQ jobs.
 * Each of the 9 flow types creates a delayed job when triggered.
 */

import type { FlowType } from '@appfy/shared'
import type { AutomationConfigRow } from './repository.js'

/** Default delays per flow type (in seconds) */
export const DEFAULT_DELAYS: Record<FlowType, number> = {
  cart_abandoned: 3600, // 1h
  pix_recovery: 1800, // 30min
  boleto_recovery: 3600, // 1h
  welcome: 300, // 5min
  checkout_abandoned: 3600, // 1h
  order_confirmed: 0, // immediate
  tracking_created: 0, // immediate
  browse_abandoned: 7200, // 2h
  upsell: 259200, // 3 days
}

/** Job payload for push dispatch queue */
export interface AutomationJobPayload {
  readonly tenantId: string
  readonly flowType: FlowType
  readonly targetUserId: string
  readonly templateData: {
    readonly title: string
    readonly body: string
  }
  readonly notificationId: string | null
}

/** Queue interface matching BullMQ */
export interface QueueAdapter {
  add(
    name: string,
    data: unknown,
    opts?: Record<string, unknown>,
  ): Promise<{ id: string }>
}

export class AutomationTriggerService {
  constructor(
    private readonly queue: QueueAdapter,
    private readonly getConfig: (
      tenantId: string,
      flowType: FlowType,
    ) => Promise<AutomationConfigRow | undefined>,
  ) {}

  /**
   * Triggers a flow for a given event.
   * - Checks if flow is enabled
   * - Uses custom delay from config or default
   * - Uses custom template from config
   * - Creates a delayed BullMQ job
   *
   * Returns the job ID if created, null if flow is disabled.
   */
  async trigger(
    tenantId: string,
    flowType: FlowType,
    targetUserId: string,
    notificationId: string | null = null,
  ): Promise<string | null> {
    const config = await this.getConfig(tenantId, flowType)

    // No config or disabled: no job
    if (!config || !config.isEnabled) {
      return null
    }

    const delayMs = config.delaySeconds * 1000
    const payload: AutomationJobPayload = {
      tenantId,
      flowType,
      targetUserId,
      templateData: {
        title: config.templateTitle,
        body: config.templateBody,
      },
      notificationId,
    }

    const result = await this.queue.add('push-dispatch', payload, {
      delay: delayMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    })

    return result.id
  }

  /**
   * Gets the effective delay for a flow type.
   * Custom from config takes priority over default.
   */
  static getDelay(config: AutomationConfigRow | undefined, flowType: FlowType): number {
    if (config?.delaySeconds !== undefined) {
      return config.delaySeconds
    }
    return DEFAULT_DELAYS[flowType]
  }
}
