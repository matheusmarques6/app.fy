import { createDependencies, pushDispatchQueue } from '@appfy/core'
import { createDrizzleClient } from '@appfy/db'
import { parseEnv, pushEnvSchema } from '../shared/env.js'
import { createLogger } from '../shared/logger.js'
import { createRedisConnectionOptions } from '../shared/redis.js'
import { createWorker, registerGracefulShutdown } from '../shared/worker-factory.js'
import { createPushDispatchProcessor } from './push-dispatch.worker.js'

const logger = createLogger('push-dispatch')

const env = parseEnv(pushEnvSchema)

logger.info('Starting push-dispatch worker')

const connection = createRedisConnectionOptions(env.REDIS_URL)

const db = createDrizzleClient(env.DATABASE_URL)

const deps = createDependencies({
  db,
  stripeSecretKey: env.STRIPE_SECRET_KEY,
  oneSignalApiKey: env.ONESIGNAL_API_KEY,
  encryptionSecret: env.ENCRYPTION_SECRET,
})

const processor = createPushDispatchProcessor(deps, logger)

const worker = createWorker({
  queueName: pushDispatchQueue.name,
  connection,
  processor,
  concurrency: 5,
})

registerGracefulShutdown([worker])

logger.info('Push-dispatch worker started', { queue: pushDispatchQueue.name })
