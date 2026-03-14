import type { AppEventType, FlowType } from '@appfy/shared'
import type { AutomationTriggerService } from '../automations/trigger.service.js'
import type { AppEventRow } from './types.js'

/** Repository to check event history for trigger logic */
export interface EventHistoryLookup {
  /** Check if a user has any previous events of a given type */
  hasAnyEvent(tenantId: string, appUserId: string, eventType: AppEventType): Promise<boolean>
  /** Check if user has a specific event within a time window */
  hasEventWithinWindow(
    tenantId: string,
    appUserId: string,
    eventType: AppEventType,
    windowSeconds: number,
  ): Promise<boolean>
}

export interface EventProcessorDeps {
  triggerService: AutomationTriggerService
  eventHistory: EventHistoryLookup
}

/** Maps event types to the automation flows they trigger */
export const EVENT_TO_FLOW_MAP: Partial<Record<AppEventType, FlowType>> = {
  app_opened: 'welcome',
  product_viewed: 'browse_abandoned',
  purchase_completed: 'upsell',
}

/** Browse abandoned check window in seconds (2-4h, using 2h) */
export const BROWSE_ABANDONED_WINDOW_SECONDS = 2 * 60 * 60

/**
 * Processes ingested events and dispatches automation triggers.
 *
 * Rules:
 * - app_opened: First ever → trigger welcome. Second+ → skip
 * - product_viewed without add_to_cart within window → schedule browse_abandoned check
 * - purchase_completed → trigger upsell
 * - Each trigger checks automation_configs.is_enabled
 */
export class EventProcessorService {
  private readonly triggerService: AutomationTriggerService
  private readonly eventHistory: EventHistoryLookup

  constructor(deps: EventProcessorDeps) {
    this.triggerService = deps.triggerService
    this.eventHistory = deps.eventHistory
  }

  /**
   * Processes a single ingested event and triggers appropriate automation.
   * Returns the job ID if a trigger was created, null otherwise.
   */
  async process(tenantId: string, event: AppEventRow): Promise<string | null> {
    switch (event.eventType) {
      case 'app_opened':
        return this.handleAppOpened(tenantId, event)
      case 'product_viewed':
        return this.handleProductViewed(tenantId, event)
      case 'purchase_completed':
        return this.handlePurchaseCompleted(tenantId, event)
      default:
        return null
    }
  }

  /**
   * Welcome flow: Only triggers on FIRST app_opened ever.
   * Checks if any previous app_opened event exists for this user.
   */
  private async handleAppOpened(tenantId: string, event: AppEventRow): Promise<string | null> {
    const hasPrevious = await this.eventHistory.hasAnyEvent(
      tenantId,
      event.appUserId,
      'app_opened',
    )

    // If there are previous events (besides the current one), this is not the first
    if (hasPrevious) {
      return null
    }

    return this.triggerService.trigger(tenantId, 'welcome', event.appUserId)
  }

  /**
   * Browse abandoned: Only schedules if no recent add_to_cart exists.
   * If user already added to cart, no need for browse_abandoned push.
   */
  private async handleProductViewed(tenantId: string, event: AppEventRow): Promise<string | null> {
    // Check if user already added to cart recently (within browse_abandoned window)
    const hasAddedToCart = await this.eventHistory.hasEventWithinWindow(
      tenantId,
      event.appUserId,
      'add_to_cart',
      BROWSE_ABANDONED_WINDOW_SECONDS,
    )

    if (hasAddedToCart) {
      return null
    }

    return this.triggerService.trigger(tenantId, 'browse_abandoned', event.appUserId)
  }

  /**
   * Upsell flow: Triggers after purchase with delay (3-7 days).
   */
  private async handlePurchaseCompleted(tenantId: string, event: AppEventRow): Promise<string | null> {
    return this.triggerService.trigger(tenantId, 'upsell', event.appUserId)
  }
}
