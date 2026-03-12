import type { FlowDefinition } from './types.js'

export const welcomeFlow: FlowDefinition = {
  flowType: 'welcome',
  triggerEvent: 'app_opened',
  defaultDelaySeconds: 300, // 5 minutes
  templateRef: 'welcome',
  description: 'Triggered on first app open by a new user',
}
