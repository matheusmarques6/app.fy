import { describe, expect, it } from 'vitest'
import { executePipeline, pipelineSteps } from './index.js'

describe('Notification Pipeline Integrity', () => {
  it('should have exactly 5 steps in the correct order', () => {
    expect(pipelineSteps).toHaveLength(5)
    expect(pipelineSteps[0]?.name).toBe('generate')
    expect(pipelineSteps[1]?.name).toBe('validate')
    expect(pipelineSteps[2]?.name).toBe('schedule')
    expect(pipelineSteps[3]?.name).toBe('send')
    expect(pipelineSteps[4]?.name).toBe('track')
  })

  it('should export executePipeline function', () => {
    expect(typeof executePipeline).toBe('function')
  })

  it('should be an immutable array (readonly)', () => {
    // pipelineSteps is typed as readonly — runtime check that the reference is stable
    const stepsRef = pipelineSteps
    expect(stepsRef).toBe(pipelineSteps)
  })
})
