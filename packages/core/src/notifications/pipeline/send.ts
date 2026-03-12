import type { PipelineContext } from '../types.js'

/**
 * Pipeline Step 4: Send
 * Dispatches the notification via the push provider.
 */
export async function send(context: PipelineContext): Promise<PipelineContext> {
  // Stub — real implementation calls PushService.send()
  return context
}
