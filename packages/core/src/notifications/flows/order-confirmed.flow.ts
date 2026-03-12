import type { FlowDefinition } from './types.js'

export const orderConfirmedFlow: FlowDefinition = {
  flowType: 'order_confirmed',
  triggerEvent: 'purchase_completed',
  // 60s operational buffer — webhooks may arrive before platform data is fully consistent.
  // Spec says 'immediate' meaning no user-facing delay, not 0ms.
  defaultDelaySeconds: 60,
  templateRef: 'order-confirmed',
  description: 'Triggered immediately after a successful purchase',
}
