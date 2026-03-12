import type { FlowDefinition } from './types.js'

export const checkoutAbandonedFlow: FlowDefinition = {
  flowType: 'checkout_abandoned',
  triggerEvent: 'checkout_started',
  defaultDelaySeconds: 3600, // 1 hour
  templateRef: 'checkout-abandoned',
  description: 'Triggered when user starts checkout but does not complete purchase',
}
