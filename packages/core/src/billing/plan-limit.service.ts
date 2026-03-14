/**
 * Plan Limit Service — checks notification limits based on plan.
 * Automated notifications NEVER blocked.
 * Manual notifications blocked when limit reached (Starter = 15/month).
 */

import type { NotificationType, PlanName } from '@appfy/shared'
import { PLAN_LIMITS } from '@appfy/shared'
import { NotificationLimitExceededError } from '../errors.js'
import type { TenantRepository, TenantRow } from '../tenants/repository.js'

export interface PlanLimitCheckResult {
  readonly allowed: boolean
  readonly currentCount: number
  readonly limit: number | null
  readonly remaining: number | null
}

/**
 * Pure function: checks if a notification can be sent given plan limits.
 * Layer 1: no external deps.
 */
export function checkPlanLimit(
  notificationType: NotificationType,
  planName: PlanName,
  currentCount: number,
): PlanLimitCheckResult {
  // Automated notifications are NEVER blocked
  if (notificationType === 'automated') {
    return {
      allowed: true,
      currentCount,
      limit: null,
      remaining: null,
    }
  }

  const planLimit = PLAN_LIMITS[planName]
  const limit = planLimit.manualNotificationsPerMonth

  // null limit = unlimited (Business/Elite)
  if (limit === null) {
    return {
      allowed: true,
      currentCount,
      limit: null,
      remaining: null,
    }
  }

  const allowed = currentCount < limit
  return {
    allowed,
    currentCount,
    limit,
    remaining: Math.max(0, limit - currentCount),
  }
}

export class PlanLimitService {
  constructor(private readonly tenantRepo: TenantRepository) {}

  /**
   * Checks if a notification can be created/sent.
   * Throws NotificationLimitExceededError if manual limit reached.
   */
  async assertCanSendNotification(
    tenantId: string,
    notificationType: NotificationType,
    tenant: TenantRow,
  ): Promise<void> {
    // Automated notifications are NEVER blocked
    if (notificationType === 'automated') {
      return
    }

    const planName = (tenant.platform ?? 'starter') as PlanName
    const result = checkPlanLimit(notificationType, planName, tenant.notificationCountCurrentPeriod)

    if (!result.allowed) {
      throw new NotificationLimitExceededError(tenantId, result.limit!)
    }
  }

  /**
   * Increments the notification count for a tenant (atomic).
   */
  async incrementCount(tenantId: string, amount = 1): Promise<void> {
    await this.tenantRepo.incrementNotificationCount(tenantId, amount)
  }
}
