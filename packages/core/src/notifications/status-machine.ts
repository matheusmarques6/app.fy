/**
 * Notification Status Machine — Layer 1 pure logic.
 * Defines valid status transitions.
 * Zero external dependencies.
 */

import type { NotificationStatus } from '@appfy/shared'

/**
 * Valid forward transitions for notification status.
 * `failed` can be reached from ANY status.
 */
const VALID_TRANSITIONS: Record<NotificationStatus, readonly NotificationStatus[]> = {
  draft: ['scheduled', 'sending'],
  scheduled: ['sending', 'failed'],
  sending: ['sent', 'failed'],
  sent: ['completed', 'failed'],
  completed: ['failed'],
  failed: ['draft'],
}

/**
 * Checks if a status transition is valid.
 * Returns true if the transition is allowed.
 */
export function isValidTransition(from: NotificationStatus, to: NotificationStatus): boolean {
  // `failed` can be reached from any state
  if (to === 'failed') return true

  const allowed = VALID_TRANSITIONS[from]
  return allowed?.includes(to) ?? false
}

/**
 * Returns the list of statuses that can be transitioned to from the given status.
 */
export function getValidNextStatuses(from: NotificationStatus): readonly NotificationStatus[] {
  const forward = VALID_TRANSITIONS[from] ?? []
  // Always include 'failed' if not already present
  if (!forward.includes('failed')) {
    return [...forward, 'failed']
  }
  return forward
}

/**
 * Validates that the transition can proceed.
 * Throws descriptive error if transition is invalid.
 */
export function assertValidTransition(from: NotificationStatus, to: NotificationStatus): void {
  if (!isValidTransition(from, to)) {
    throw new Error(
      `Invalid status transition from '${from}' to '${to}'. Valid targets: ${getValidNextStatuses(from).join(', ')}`,
    )
  }
}
