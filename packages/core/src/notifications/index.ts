export { boletoRecoveryFlow } from './flows/boleto-recovery.flow.js'
export { browseAbandonedFlow } from './flows/browse-abandoned.flow.js'
// Flow definitions
export { cartAbandonedFlow } from './flows/cart-abandoned.flow.js'
export { checkoutAbandonedFlow } from './flows/checkout-abandoned.flow.js'
export { orderConfirmedFlow } from './flows/order-confirmed.flow.js'
export { pixRecoveryFlow } from './flows/pix-recovery.flow.js'
export { trackingCreatedFlow } from './flows/tracking-created.flow.js'
export type { FlowDefinition } from './flows/types.js'
export { upsellFlow } from './flows/upsell.flow.js'
export { welcomeFlow } from './flows/welcome.flow.js'
export type { PipelineStep } from './pipeline/index.js'
export {
  executePipeline,
  generate,
  pipelineSteps,
  schedule,
  send,
  track,
  validate,
} from './pipeline/index.js'
export { NotificationRepository } from './repository.js'
export { NotificationService } from './service.js'
export { boletoRecoveryTemplate } from './templates/boleto-recovery.template.js'
export { browseAbandonedTemplate } from './templates/browse-abandoned.template.js'

// Templates
export { cartAbandonedTemplate } from './templates/cart-abandoned.template.js'
export { checkoutAbandonedTemplate } from './templates/checkout-abandoned.template.js'
export { orderConfirmedTemplate } from './templates/order-confirmed.template.js'
export { pixRecoveryTemplate } from './templates/pix-recovery.template.js'
export { trackingCreatedTemplate } from './templates/tracking-created.template.js'
export type { NotificationTemplate } from './templates/types.js'
export { upsellTemplate } from './templates/upsell.template.js'
export { welcomeTemplate } from './templates/welcome.template.js'
export type {
  CreateNotificationInput,
  Notification,
  PipelineContext,
  PipelineResult,
  UpdateNotificationStatusInput,
} from './types.js'
