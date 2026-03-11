import 'dotenv/config'
import { createDrizzleClient } from '../client.js'
import { plans } from '../schema/index.js'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const db = createDrizzleClient(DATABASE_URL)

async function seed() {
  console.log('Seeding plans...')

  await db
    .insert(plans)
    .values([
      {
        name: 'starter',
        notificationLimit: 15,
        priceMonthly: 12700,
        priceYearly: 127000,
        features: {
          manual: true,
          automated: true,
          abTesting: false,
          analytics: 'basic',
        },
        stripePriceId: null,
      },
      {
        name: 'business',
        notificationLimit: null,
        priceMonthly: 19700,
        priceYearly: 197000,
        features: {
          manual: true,
          automated: true,
          abTesting: true,
          analytics: 'advanced',
        },
        stripePriceId: null,
      },
      {
        name: 'elite',
        notificationLimit: null,
        priceMonthly: 29700,
        priceYearly: 297000,
        features: {
          manual: true,
          automated: true,
          abTesting: true,
          analytics: 'full',
          prioritySupport: true,
        },
        stripePriceId: null,
      },
    ])
    .onConflictDoNothing()

  console.log('Seed complete.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
