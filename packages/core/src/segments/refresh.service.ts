/**
 * Segment Refresh Service — re-evaluates segment rules against app users.
 * Adds qualifying users, removes non-qualifying users.
 * Idempotent: running twice produces the same result.
 */

import type { AppUserRepository, AppUserRow } from '../app-users/repository.js'
import type { SegmentRepository } from './repository.js'
import { evaluateSegmentRules, type SegmentRuleGroup, type UserData } from './rules-engine.js'

/** Batch size for processing users */
const BATCH_SIZE = 1000

export interface RefreshResult {
  readonly segmentId: string
  readonly added: number
  readonly removed: number
  readonly expiredRemoved: number
  readonly totalMembers: number
}

export class SegmentRefreshService {
  constructor(
    private readonly segmentRepo: SegmentRepository,
    private readonly appUserRepo: AppUserRepository,
  ) {}

  /**
   * Refreshes membership for a single segment.
   * - Re-evaluates rules against all app_users for the tenant
   * - Adds users that now qualify
   * - Removes users that no longer qualify
   * - Removes expired memberships
   */
  async refreshSegment(tenantId: string, segmentId: string): Promise<RefreshResult> {
    const segment = await this.segmentRepo.findById(tenantId, segmentId)
    if (!segment) {
      throw new Error(`Segment not found: ${segmentId}`)
    }

    // Remove expired memberships first
    const expiredRemoved = await this.segmentRepo.removeExpiredMembers(tenantId, segmentId)

    // Get current members
    const currentMemberIds = await this.segmentRepo.getMemberIds(tenantId, segmentId)

    // Evaluate all users against rules
    const qualifyingIds = await this.evaluateAllUsers(tenantId, segment.rules)

    // Calculate diff
    const toAdd = qualifyingIds.filter((id) => !currentMemberIds.includes(id))
    const toRemove = currentMemberIds.filter((id) => !qualifyingIds.includes(id))

    // Apply changes
    if (toAdd.length > 0) {
      await this.segmentRepo.addMembers(tenantId, segmentId, toAdd)
    }
    if (toRemove.length > 0) {
      await this.segmentRepo.removeMembers(tenantId, segmentId, toRemove)
    }

    const totalMembers = currentMemberIds.length + toAdd.length - toRemove.length

    return {
      segmentId,
      added: toAdd.length,
      removed: toRemove.length,
      expiredRemoved,
      totalMembers,
    }
  }

  /**
   * Evaluates all users in a tenant against segment rules.
   * Returns IDs of qualifying users.
   */
  private async evaluateAllUsers(
    tenantId: string,
    rules: SegmentRuleGroup,
  ): Promise<string[]> {
    // Get all users (paginated internally for memory efficiency)
    const qualifyingIds: string[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const { data: users, total } = await this.appUserRepo.list(tenantId, {
        page,
        perPage: BATCH_SIZE,
      })

      for (const user of users) {
        const userData = this.userToData(user)
        if (evaluateSegmentRules(rules, userData)) {
          qualifyingIds.push(user.id)
        }
      }

      hasMore = page * BATCH_SIZE < total
      page++
    }

    return qualifyingIds
  }

  /** Maps AppUserRow to UserData for rule evaluation */
  private userToData(user: AppUserRow): UserData {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      pushOptIn: user.pushOptIn,
      totalPurchases: user.totalPurchases,
      totalSpent: user.totalSpent,
      lastActiveAt: user.lastActiveAt,
    }
  }
}
