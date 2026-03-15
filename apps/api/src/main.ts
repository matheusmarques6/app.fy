import { createDependencies } from '@appfy/core'
import type { QueueAdapter, StripeClient } from '@appfy/core'
import { createDrizzleClient } from '@appfy/db'
import { QUEUE_NAMES } from '@appfy/shared'
import { serve } from '@hono/node-server'
import { Queue } from 'bullmq'
import Stripe from 'stripe'
import { createApp } from './app.js'
import { env } from './env.js'
import { createRedisConnectionOptions } from './redis.js'

// Initialize database client
const db = createDrizzleClient(env.DATABASE_URL)

// Initialize Stripe client
const stripeClient = new Stripe(env.STRIPE_SECRET_KEY) as unknown as StripeClient

// Initialize BullMQ queue for data ingestion
const dataIngestionBullQueue = new Queue(QUEUE_NAMES.dataIngestion, {
  connection: createRedisConnectionOptions(env.REDIS_URL),
})

const dataIngestionQueue: QueueAdapter = {
  async add(name: string, data: unknown, opts?: Record<string, unknown>) {
    const job = await dataIngestionBullQueue.add(name, data as Record<string, unknown>, opts)
    return { id: job.id ?? 'unknown' }
  },
}

// Plan price registry — maps plan names to Stripe price IDs
// These should be configured via env vars in production
const planPriceRegistry = {
  starter: process.env.STRIPE_PRICE_STARTER ?? '',
  business: process.env.STRIPE_PRICE_BUSINESS ?? '',
  elite: process.env.STRIPE_PRICE_ELITE ?? '',
}

// Create dependencies via factory DI
const deps = createDependencies(
  {
    db,
    stripeClient,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    planPriceRegistry,
    oneSignalApiKey: env.ONESIGNAL_API_KEY,
    encryptionSecret: env.ENCRYPTION_SECRET,
  },
  {
    dataIngestionQueue,
  },
)

// Create Hono app with all routes
const app = createApp(deps)

// Start HTTP server
const port = env.PORT
serve({ fetch: app.fetch, port }, (info) => {
  console.info(
    JSON.stringify({
      level: 'info',
      message: `AppFy API server started on port ${info.port}`,
      port: info.port,
      timestamp: new Date().toISOString(),
    }),
  )
})
