import type { PipelineContext } from '../types.js'

/**
 * Pipeline Step 1: Generate
 * Resolves the notification content (template variables, A/B variant selection).
 * Pure function: input context -> output context with resolved content.
 */
export async function generate(context: PipelineContext): Promise<PipelineContext> {
  // Stub — real implementation resolves template variables
  return context
}
