import type { FlowDefinition } from './types.js'

export const pixRecoveryFlow: FlowDefinition = {
  flowType: 'pix_recovery',
  triggerEvent: 'pix_pending',
  defaultDelaySeconds: 1800, // 30 minutes
  templateRef: 'pix-recovery',
  description: 'Triggered when a Pix payment is pending and not confirmed',
}
