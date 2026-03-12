import type { FlowDefinition } from './types.js'

export const cartAbandonedFlow: FlowDefinition = {
  flowType: 'cart_abandoned',
  triggerEvent: 'add_to_cart',
  defaultDelaySeconds: 3600, // 1 hour
  templateRef: 'cart-abandoned',
  description: 'Triggered when user adds to cart but does not purchase within delay period',
}
