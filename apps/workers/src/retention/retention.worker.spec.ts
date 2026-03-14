import { describe, it, expect } from 'vitest'
import { createRetentionProcessor } from './retention.worker.js'
import type { Job } from 'bullmq'
import type { RetentionJobPayload } from './retention.worker.js'

// --- Inline spies ---

class RetentionServiceSpy {
  runAllCalled = false
  result = { deliveriesDeleted: 42, eventsDeleted: 15 }

  async runAll() {
    this.runAllCalled = true
    return this.result
  }

  async cleanExpiredDeliveries() { return this.result.deliveriesDeleted }
  async cleanExpiredEvents() { return this.result.eventsDeleted }
}

class LoggerSpy {
  messages: Array<{ level: string; message: string; meta?: Record<string, unknown> }> = []

  info(message: string, meta?: Record<string, unknown>) {
    this.messages.push({ level: 'info', message, meta })
  }
  warn(message: string, meta?: Record<string, unknown>) {
    this.messages.push({ level: 'warn', message, meta })
  }
  error(message: string, meta?: Record<string, unknown>) {
    this.messages.push({ level: 'error', message, meta })
  }
}

function makeJob(data: RetentionJobPayload): Job<RetentionJobPayload> {
  return {
    id: 'job-1',
    name: 'retention',
    data,
  } as unknown as Job<RetentionJobPayload>
}

function makeSut() {
  const retentionService = new RetentionServiceSpy()
  const logger = new LoggerSpy()
  const processor = createRetentionProcessor(retentionService as never, logger)
  return { processor, retentionService, logger }
}

describe('RetentionWorker', () => {
  it('should call retentionService.runAll and log results', async () => {
    const { processor, retentionService, logger } = makeSut()

    await processor(makeJob({ type: 'daily_cleanup' }))

    expect(retentionService.runAllCalled).toBe(true)

    // Should have 2 log messages (start + completed)
    expect(logger.messages).toHaveLength(2)
    expect(logger.messages[0].message).toBe('Starting retention cleanup')
    expect(logger.messages[1].message).toBe('Retention cleanup completed')
    expect(logger.messages[1].meta).toEqual({
      jobId: 'job-1',
      deliveriesDeleted: 42,
      eventsDeleted: 15,
    })
  })
})
