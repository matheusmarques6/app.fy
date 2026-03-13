import { z } from 'zod'

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),

  // Database
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),

  // Auth (Supabase)
  SUPABASE_URL: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),

  // Integrations: Shopify
  SHOPIFY_CLIENT_ID: z.string().default(''),
  SHOPIFY_CLIENT_SECRET: z.string().default(''),

  // Integrations: Nuvemshop
  NUVEMSHOP_APP_ID: z.string().default(''),
  NUVEMSHOP_APP_SECRET: z.string().default(''),

  // Integrations: Klaviyo
  KLAVIYO_API_KEY: z.string().default(''),

  // Push: OneSignal
  ONESIGNAL_API_KEY: z.string().min(1),
  ONESIGNAL_USER_AUTH_KEY: z.string().min(1),

  // Queue
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Storage: Cloudflare R2
  CLOUDFLARE_R2_ACCOUNT_ID: z.string().default(''),
  CLOUDFLARE_R2_ACCESS_KEY: z.string().default(''),
  CLOUDFLARE_R2_SECRET_KEY: z.string().default(''),
  CLOUDFLARE_R2_BUCKET: z.string().default(''),

  // Billing: Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),

  // Monitoring
  SENTRY_DSN: z.string().default(''),

  // Encryption
  ENCRYPTION_SECRET: z.string().min(32),

  // JWT
  JWT_SECRET: z.string().min(1),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors
    const missing = Object.entries(formatted)
      .map(([key, errors]) => `  ${key}: ${(errors ?? []).join(', ')}`)
      .join('\n')
    throw new Error(`Invalid environment variables:\n${missing}`)
  }
  return result.data
}

export const env = validateEnv()
