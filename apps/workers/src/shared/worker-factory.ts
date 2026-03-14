import { type Job, type Processor, Worker } from 'bullmq'
import type { RedisOptions } from 'ioredis'
import { logger } from './logger.js'

export interface WorkerConfig<T> {
  readonly queueName: string
  readonly connection: RedisOptions
  readonly processor: Processor<T>
  readonly concurrency?: number
}

/**
 * Creates a BullMQ Worker with structured logging for lifecycle events.
 *
 * Use {@link registerGracefulShutdown} after creating all workers
 * to ensure all are closed before process exit.
 */
export function createWorker<T>(config: WorkerConfig<T>): Worker<T> {
  const { queueName, connection, processor, concurrency = 1 } = config

  const worker = new Worker<T>(queueName, processor, {
    connection,
    concurrency,
  })

  worker.on('ready', () => {
    logger.info('Worker ready', { queue: queueName, concurrency })
  })

  worker.on('completed', (job: Job<T>) => {
    logger.info('Job completed', { queue: queueName, jobId: job.id, jobName: job.name })
  })

  worker.on('failed', (job: Job<T> | undefined, error: Error) => {
    logger.error('Job failed', {
      queue: queueName,
      jobId: job?.id,
      jobName: job?.name,
      error: error.message,
      attemptsMade: job?.attemptsMade,
    })
  })

  worker.on('error', (error: Error) => {
    logger.error('Worker error', { queue: queueName, error: error.message })
  })

  return worker
}

/**
 * Registers SIGTERM/SIGINT handlers that close all workers gracefully
 * before exiting the process. Call once per entrypoint after creating
 * all workers.
 */
export function registerGracefulShutdown(workers: Worker[]): void {
  let shuttingDown = false

  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true

    logger.info('Graceful shutdown initiated', { signal, workerCount: workers.length })

    await Promise.allSettled(
      workers.map(async (w) => {
        logger.info('Closing worker', { queue: w.name })
        await w.close()
        logger.info('Worker closed', { queue: w.name })
      }),
    )

    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}
