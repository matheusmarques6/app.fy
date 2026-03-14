import { createDependencies, dataIngestionQueue } from '@appfy/core'
import { createDrizzleClient } from '@appfy/db'
import { ingestionEnvSchema, parseEnv } from '../shared/env.js'
import { createLogger } from '../shared/logger.js'
import { createRedisConnectionOptions } from '../shared/redis.js'
import { createWorker, registerGracefulShutdown } from '../shared/worker-factory.js'
import { createDataIngestionProcessor } from './data-ingestion.worker.js'

const logger = createLogger('data-ingestion')

const env = parseEnv(ingestionEnvSchema)

logger.info('Starting data-ingestion worker')

const connection = createRedisConnectionOptions(env.REDIS_URL)

const db = createDrizzleClient(env.DATABASE_URL)

const deps = createDependencies({
  db,
  stripeSecretKey: env.STRIPE_SECRET_KEY,
  oneSignalApiKey: env.ONESIGNAL_API_KEY,
  encryptionSecret: env.ENCRYPTION_SECRET,
})

const processor = createDataIngestionProcessor(deps, logger)

const worker = createWorker({
  queueName: dataIngestionQueue.name,
  connection,
  processor,
  concurrency: 10,
})

registerGracefulShutdown([worker])

logger.info('Data-ingestion worker started', { queue: dataIngestionQueue.name })
