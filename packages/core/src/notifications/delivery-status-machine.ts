/**
 * Delivery Status Machine — Layer 1 pure logic.
 * Defines valid status transitions for notification deliveries.
 * Zero external dependencies.
 *
 * Pipeline: pending → sent → delivered → opened → clicked → converted
 * `failed` can be reached from ANY status.
 */

import type { DeliveryStatus } from '@appfy/shared'

/**
 * Valid forward transitions for delivery status.
 * `failed` can be reached from ANY status.
 */
const VALID_DELIVERY_TRANSITIONS: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  pending: ['sent', 'failed'],
  sent: ['delivered', 'failed'],
  delivered: ['opened', 'failed'],
  opened: ['clicked', 'failed'],
  clicked: ['converted', 'failed'],
  converted: ['failed'],
  failed: [],
}

/**
 * Checks if a delivery status transition is valid.
 * Returns true if the transition is allowed.
 */
export function isValidDeliveryTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  // Self-transition is never valid
  if (from === to) return false

  // `failed` can be reached from any state
  if (to === 'failed') return true

  const allowed = VALID_DELIVERY_TRANSITIONS[from]
  return allowed?.includes(to) ?? false
}

/**
 * Validates that the delivery status transition can proceed.
 * Throws descriptive error if transition is invalid.
 */
export function assertValidDeliveryTransition(from: DeliveryStatus, to: DeliveryStatus): void {
  if (!isValidDeliveryTransition(from, to)) {
    const allowed = VALID_DELIVERY_TRANSITIONS[from] ?? []
    const targets = allowed.includes('failed') ? allowed : [...allowed, 'failed']
    throw new Error(
      `Invalid delivery status transition from '${from}' to '${to}'. Valid targets: ${targets.join(', ')}`,
    )
  }
}
