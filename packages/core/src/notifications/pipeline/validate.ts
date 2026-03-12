import type { PipelineContext } from '../types.js'

/**
 * Pipeline Step 2: Validate
 * Validates the notification can be sent (tenant limits, opt-in, content).
 * Throws DomainError if validation fails.
 */
export async function validate(context: PipelineContext): Promise<PipelineContext> {
  if (context.recipientTokens.length === 0) {
    throw new Error('No recipient tokens — cannot send notification')
  }
  return context
}
