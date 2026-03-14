import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { rateLimitMiddleware, RedisRateLimitStore } from './rate-limit.js'

function createTestApp(maxRequests: number, windowMs = 60_000) {
  const app = new Hono()
  app.use('/*', rateLimitMiddleware({ maxRequests, windowMs }))
  app.get('/test', (c) => c.json({ ok: true }))
  return app
}

describe('Rate Limiting Middleware (Layer 1)', () => {
  describe('basic rate limiting', () => {
    it('should allow requests within the limit', async () => {
      const app = createTestApp(5)

      const res = await app.request('/test', { headers: { 'x-forwarded-for': '1.2.3.4' } })

      expect(res.status).toBe(200)
      expect(res.headers.get('X-RateLimit-Limit')).toBe('5')
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('4')
    })

    it('should block requests exceeding the limit', async () => {
      const app = createTestApp(3)

      for (let i = 0; i < 3; i++) {
        const res = await app.request('/test', { headers: { 'x-forwarded-for': '1.2.3.4' } })
        expect(res.status).toBe(200)
      }

      // 4th request exceeds limit
      const blocked = await app.request('/test', { headers: { 'x-forwarded-for': '1.2.3.4' } })
      expect(blocked.status).toBe(429)

      const body = (await blocked.json()) as { error: { code: string } }
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
    })

    it('should return correct remaining count', async () => {
      const app = createTestApp(3)

      const res1 = await app.request('/test', { headers: { 'x-forwarded-for': '1.2.3.4' } })
      expect(res1.headers.get('X-RateLimit-Remaining')).toBe('2')

      const res2 = await app.request('/test', { headers: { 'x-forwarded-for': '1.2.3.4' } })
      expect(res2.headers.get('X-RateLimit-Remaining')).toBe('1')

      const res3 = await app.request('/test', { headers: { 'x-forwarded-for': '1.2.3.4' } })
      expect(res3.headers.get('X-RateLimit-Remaining')).toBe('0')
    })

    it('should return 0 remaining when over limit', async () => {
      const app = createTestApp(1)

      await app.request('/test', { headers: { 'x-forwarded-for': '1.2.3.4' } })
      const blocked = await app.request('/test', { headers: { 'x-forwarded-for': '1.2.3.4' } })

      expect(blocked.headers.get('X-RateLimit-Remaining')).toBe('0')
    })
  })

  describe('per-IP isolation', () => {
    it('should track different IPs independently', async () => {
      const app = createTestApp(2)

      // IP A uses 2 requests
      await app.request('/test', { headers: { 'x-forwarded-for': '1.1.1.1' } })
      await app.request('/test', { headers: { 'x-forwarded-for': '1.1.1.1' } })

      // IP A is blocked
      const blockedA = await app.request('/test', { headers: { 'x-forwarded-for': '1.1.1.1' } })
      expect(blockedA.status).toBe(429)

      // IP B is still allowed
      const allowedB = await app.request('/test', { headers: { 'x-forwarded-for': '2.2.2.2' } })
      expect(allowedB.status).toBe(200)
    })
  })

  describe('window expiry', () => {
    it('should reset counter after window expires', async () => {
      const app = createTestApp(1, 50) // 50ms window

      const res1 = await app.request('/test', { headers: { 'x-forwarded-for': '1.2.3.4' } })
      expect(res1.status).toBe(200)

      const blocked = await app.request('/test', { headers: { 'x-forwarded-for': '1.2.3.4' } })
      expect(blocked.status).toBe(429)

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 60))

      const res3 = await app.request('/test', { headers: { 'x-forwarded-for': '1.2.3.4' } })
      expect(res3.status).toBe(200)
    })
  })

  describe('RedisRateLimitStore', () => {
    it('should set expiry on first request', async () => {
      let incrCount = 0
      const expireCalls: Array<{ key: string; ms: number }> = []
      const mockRedis = {
        async incr(_key: string) {
          incrCount++
          return incrCount
        },
        async pexpire(key: string, ms: number) {
          expireCalls.push({ key, ms })
          return 1
        },
        async pttl(_key: string) {
          return 60000
        },
      }

      const store = new RedisRateLimitStore(mockRedis)

      const count1 = await store.increment('rl:test', 60000)
      expect(count1).toBe(1)
      expect(expireCalls).toHaveLength(1)
      expect(expireCalls[0]!.ms).toBe(60000)

      // Second call should not set expiry again
      const count2 = await store.increment('rl:test', 60000)
      expect(count2).toBe(2)
      expect(expireCalls).toHaveLength(1) // still 1
    })
  })
})
