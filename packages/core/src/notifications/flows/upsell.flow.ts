import type { FlowDefinition } from './types.js'

export const upsellFlow: FlowDefinition = {
  flowType: 'upsell',
  triggerEvent: 'purchase_completed',
  defaultDelaySeconds: 259200, // 3 days minimum per spec
  templateRef: 'upsell',
  description: 'Triggered after purchase to recommend related products',
}
