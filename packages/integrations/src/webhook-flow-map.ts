import type { FlowType } from '@appfy/shared'

/**
 * Maps platform webhook topics to automation flow types.
 * Both Shopify and Nuvemshop use similar topic naming with slight variations.
 */
export const WEBHOOK_FLOW_MAP: Readonly<Record<string, FlowType | undefined>> = {
  // Shopify topics
  'orders/create': 'order_confirmed',
  'orders/paid': 'order_confirmed',
  'carts/create': 'cart_abandoned',
  'checkouts/create': 'checkout_abandoned',
  'fulfillments/create': 'tracking_created',

  // Nuvemshop topics (uses past tense: created instead of create)
  'orders/created': 'order_confirmed',
  'carts/created': 'cart_abandoned',
  'checkouts/created': 'checkout_abandoned',
  'fulfillments/created': 'tracking_created',
}

/**
 * Look up the automation flow type for a given webhook topic.
 * Returns undefined for topics that don't map to a flow (e.g. app/uninstalled).
 */
export function mapWebhookToFlowType(topic: string): FlowType | undefined {
  return WEBHOOK_FLOW_MAP[topic]
}
