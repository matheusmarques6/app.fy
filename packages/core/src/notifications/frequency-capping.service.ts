import type { FlowType } from '@appfy/shared'
import { PLAN_LIMITS, FREQUENCY_CAPS } from '@appfy/shared'
import type { PlanName } from '@appfy/shared'

/** Cache adapter for Redis-based counters */
export interface FrequencyCappingCache {
  get(key: string): Promise<number | null>
  increment(key: string, ttlSeconds: number): Promise<number>
}

export interface FrequencyCappingCheck {
  readonly allowed: boolean
  readonly reason?: string
  readonly currentCount?: number
  readonly limit?: number | null
}

/**
 * Frequency capping service — controls how many pushes a user receives per day.
 *
 * Rules:
 * - Starter: max 2/day, Business: max 4/day, Elite: unlimited (null)
 * - Count per app_user, NOT per device
 * - Flow types are independent (cart_abandoned doesn't block welcome)
 * - Max 1 cart_abandoned per session
 * - Admin override for manual campaigns (NOT for automated flows)
 * - Counter reset at midnight UTC
 */
export class FrequencyCappingService {
  constructor(private readonly cache: FrequencyCappingCache) {}

  /**
   * Checks whether a push is allowed for a given user.
   * Does NOT increment — call `record()` after successful send.
   */
  async check(
    tenantId: string,
    appUserId: string,
    plan: PlanName,
    options?: {
      flowType?: FlowType
      sessionId?: string
      isManualCampaign?: boolean
    },
  ): Promise<FrequencyCappingCheck> {
    // Admin override for manual campaigns
    if (options?.isManualCampaign && FREQUENCY_CAPS.adminOverrideManual) {
      return { allowed: true }
    }

    const limit = PLAN_LIMITS[plan]?.dailyPushLimitPerUser ?? null

    // Unlimited plan
    if (limit === null) {
      return { allowed: true, limit: null }
    }

    // Check daily counter (scoped by flow type for independence)
    const dailyKey = this.dailyKey(tenantId, appUserId, options?.flowType)
    const currentCount = await this.cache.get(dailyKey)
    const count = currentCount ?? 0

    if (count >= limit) {
      return {
        allowed: false,
        reason: 'daily_limit_reached',
        currentCount: count,
        limit,
      }
    }

    // Check cart_abandoned per session
    if (options?.flowType === 'cart_abandoned' && options.sessionId) {
      const sessionKey = this.cartSessionKey(tenantId, appUserId, options.sessionId)
      const sessionCount = await this.cache.get(sessionKey)
      if ((sessionCount ?? 0) >= FREQUENCY_CAPS.maxCartAbandonedPerSession) {
        return {
          allowed: false,
          reason: 'cart_abandoned_session_limit',
          currentCount: sessionCount ?? 0,
          limit: FREQUENCY_CAPS.maxCartAbandonedPerSession,
        }
      }
    }

    return { allowed: true, currentCount: count, limit }
  }

  /**
   * Records a push send for frequency capping counters.
   * Call this AFTER successful dispatch.
   */
  async record(
    tenantId: string,
    appUserId: string,
    options?: {
      flowType?: FlowType
      sessionId?: string
    },
  ): Promise<void> {
    // Increment daily counter with TTL until midnight UTC (scoped by flow type)
    const dailyKey = this.dailyKey(tenantId, appUserId, options?.flowType)
    const ttl = this.secondsUntilMidnightUtc()
    await this.cache.increment(dailyKey, ttl)

    // Increment cart_abandoned session counter
    if (options?.flowType === 'cart_abandoned' && options.sessionId) {
      const sessionKey = this.cartSessionKey(tenantId, appUserId, options.sessionId)
      // Session key expires after 24h
      await this.cache.increment(sessionKey, 86400)
    }
  }

  private dailyKey(tenantId: string, appUserId: string, flowType?: FlowType): string {
    const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC
    const suffix = flowType ? `:${flowType}` : ':global'
    return `fc:${tenantId}:${appUserId}:${date}${suffix}`
  }

  private cartSessionKey(tenantId: string, appUserId: string, sessionId: string): string {
    return `fc:cart:${tenantId}:${appUserId}:${sessionId}`
  }

  private secondsUntilMidnightUtc(): number {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setUTCDate(midnight.getUTCDate() + 1)
    midnight.setUTCHours(0, 0, 0, 0)
    return Math.ceil((midnight.getTime() - now.getTime()) / 1000)
  }
}
