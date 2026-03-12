import type { FlowDefinition } from './types.js'

export const boletoRecoveryFlow: FlowDefinition = {
  flowType: 'boleto_recovery',
  triggerEvent: 'boleto_pending',
  defaultDelaySeconds: 3600, // 1 hour — first reminder per spec
  templateRef: 'boleto-recovery',
  description: 'Triggered when a boleto is generated but not yet paid',
}
