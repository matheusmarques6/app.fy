import type { FlowDefinition } from './types.js'

export const trackingCreatedFlow: FlowDefinition = {
  flowType: 'tracking_created',
  triggerEvent: 'tracking_created',
  // 60s operational buffer — webhooks may arrive before platform data is fully consistent.
  // Spec says 'immediate' meaning no user-facing delay, not 0ms.
  defaultDelaySeconds: 60,
  templateRef: 'tracking-created',
  description: 'Triggered when a tracking code is generated for an order',
}
