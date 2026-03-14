import { z } from 'zod'

/** Base env schema shared by all workers */
export const baseEnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1),

  // Queue
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Encryption
  ENCRYPTION_SECRET: z.string().min(32),

  // Monitoring (optional)
  SENTRY_DSN: z.string().default(''),

  // Optional — not all workers need these, but createDependencies() requires strings
  ONESIGNAL_API_KEY: z.string().default(''),
  STRIPE_SECRET_KEY: z.string().default(''),
})

/** Push worker extends base with required OneSignal key */
export const pushEnvSchema = baseEnvSchema.extend({
  ONESIGNAL_API_KEY: z.string().min(1),
})

/** Data-ingestion worker uses only base vars */
export const ingestionEnvSchema = baseEnvSchema

/** Analytics worker uses only base vars */
export const analyticsEnvSchema = baseEnvSchema

/**
 * Parses and validates environment variables against the given schema.
 * Throws with a descriptive error listing all missing/invalid vars.
 */
export function parseEnv<T extends z.ZodType>(schema: T): z.infer<T> {
  const result = schema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors
    const missing = Object.entries(formatted)
      .map(([key, errors]) => `  ${key}: ${(errors as string[] | undefined)?.join(', ') ?? 'invalid'}`)
      .join('\n')
    throw new Error(`Invalid environment variables:\n${missing}`)
  }
  return result.data as z.infer<T>
}
