import type { PipelineContext, PipelineResult } from '../types.js'
import { generate } from './generate.js'
import { schedule } from './schedule.js'
import { send } from './send.js'
import { track } from './track.js'
import { validate } from './validate.js'

/**
 * Pipeline step function signature.
 * Each step takes context and returns transformed context.
 */
export type PipelineStep = (context: PipelineContext) => Promise<PipelineContext>

/**
 * The ordered pipeline steps — NEVER skip a step.
 * Generate -> Validate -> Schedule -> Send -> Track
 */
export const pipelineSteps: readonly PipelineStep[] = [
  generate,
  validate,
  schedule,
  send,
  track,
] as const

/**
 * Executes the full notification pipeline in strict order.
 * If any step throws, the pipeline halts and returns a failed result.
 */
export async function executePipeline(initialContext: PipelineContext): Promise<PipelineResult> {
  let context = initialContext

  try {
    for (const step of pipelineSteps) {
      context = await step(context)
    }

    return {
      notificationId: context.notification.id,
      recipientCount: context.recipientTokens.length,
      scheduledAt: context.notification.scheduledAt,
      status: 'sent',
    }
  } catch (error) {
    return {
      notificationId: context.notification.id,
      recipientCount: 0,
      scheduledAt: null,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown pipeline error',
    }
  }
}

export { generate } from './generate.js'
export { schedule } from './schedule.js'
export { send } from './send.js'
export { track } from './track.js'
export { validate } from './validate.js'
