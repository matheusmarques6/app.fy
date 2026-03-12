import type { FlowDefinition } from './types.js'

export const browseAbandonedFlow: FlowDefinition = {
  flowType: 'browse_abandoned',
  triggerEvent: 'product_viewed',
  defaultDelaySeconds: 7200, // 2 hours
  templateRef: 'browse-abandoned',
  description: 'Triggered when user views products but does not add to cart',
}
