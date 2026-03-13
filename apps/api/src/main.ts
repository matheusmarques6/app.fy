import { createDependencies } from '@appfy/core'
import { createDrizzleClient } from '@appfy/db'
import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { env } from './env.js'

// Initialize database client
const db = createDrizzleClient(env.DATABASE_URL)

// Create dependencies via factory DI
const deps = createDependencies({
  db,
  stripeSecretKey: env.STRIPE_SECRET_KEY,
  oneSignalApiKey: env.ONESIGNAL_API_KEY,
  encryptionSecret: env.ENCRYPTION_SECRET,
})

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
