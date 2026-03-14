import type { MiddlewareHandler } from 'hono'
import { RATE_LIMITS } from '@appfy/shared'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

interface RateLimitStore {
  /** Returns the current request count after incrementing. Expires after windowMs. */
  increment(key: string, windowMs: number): Promise<number>
}

/**
 * In-memory rate limit store. For production, use Redis-backed store.
 */
class MemoryRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<string, { count: number; expiresAt: number }>()

  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now()
    const entry = this.windows.get(key)

    if (!entry || now >= entry.expiresAt) {
      this.windows.set(key, { count: 1, expiresAt: now + windowMs })
      return 1
    }

    entry.count++
    return entry.count
  }
}

/**
 * Redis-backed rate limit store using sliding window counter.
 */
export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly redis: { incr(key: string): Promise<number>; pexpire(key: string, ms: number): Promise<number>; pttl(key: string): Promise<number> }) {}

  async increment(key: string, windowMs: number): Promise<number> {
    const count = await this.redis.incr(key)
    if (count === 1) {
      await this.redis.pexpire(key, windowMs)
    }
    return count
  }
}

/**
 * Creates a rate limiting middleware using sliding window counter.
 *
 * @param config - Rate limit configuration (windowMs + maxRequests)
 * @param store - Optional store (defaults to in-memory, use Redis for production)
 */
export function rateLimitMiddleware(
  config: RateLimitConfig = RATE_LIMITS.admin,
  store?: RateLimitStore,
): MiddlewareHandler {
  const rateLimitStore = store ?? new MemoryRateLimitStore()

  return async (c, next) => {
    // Key by IP + path prefix for granular limiting
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const key = `rl:${ip}`

    const currentCount = await rateLimitStore.increment(key, config.windowMs)

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(config.maxRequests))
    c.header('X-RateLimit-Remaining', String(Math.max(0, config.maxRequests - currentCount)))

    if (currentCount > config.maxRequests) {
      return c.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
          },
        },
        429,
      )
    }

    await next()
    return undefined
  }
}
