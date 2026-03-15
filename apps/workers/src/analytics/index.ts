import { analyticsQueue, createDependencies } from '@appfy/core'
import { createDrizzleClient } from '@appfy/db'
import { analyticsEnvSchema, parseEnv } from '../shared/env.js'
import { createLogger } from '../shared/logger.js'
import { createRedisConnectionOptions } from '../shared/redis.js'
import { createWorker, registerGracefulShutdown } from '../shared/worker-factory.js'
import { createNoopStripeClient } from '../shared/stripe-stub.js'
import { createAnalyticsProcessor } from './analytics.worker.js'

const logger = createLogger('analytics')

const env = parseEnv(analyticsEnvSchema)

logger.info('Starting analytics worker')

const connection = createRedisConnectionOptions(env.REDIS_URL)

const db = createDrizzleClient(env.DATABASE_URL)

const deps = createDependencies({
  db,
  stripeClient: createNoopStripeClient(),
  stripeWebhookSecret: '',
  planPriceRegistry: {},
  oneSignalApiKey: env.ONESIGNAL_API_KEY,
  encryptionSecret: env.ENCRYPTION_SECRET,
})

const processor = createAnalyticsProcessor(deps, logger)

const worker = createWorker({
  queueName: analyticsQueue.name,
  connection,
  processor,
  concurrency: 3,
})

registerGracefulShutdown([worker])

logger.info('Analytics worker started', { queue: analyticsQueue.name })
