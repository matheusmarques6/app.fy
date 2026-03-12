import type { PipelineContext } from '../types.js'

/**
 * Pipeline Step 3: Schedule
 * Determines send timing (immediate or delayed based on flow config).
 */
export async function schedule(context: PipelineContext): Promise<PipelineContext> {
  // Stub — real implementation checks scheduledAt / delay config
  return context
}
