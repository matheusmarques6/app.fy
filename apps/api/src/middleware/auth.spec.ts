import { Hono } from 'hono'
import * as jose from 'jose'
import { describe, expect, it, vi } from 'vitest'
import { authMiddleware } from './auth.js'
import { errorHandler } from './error-handler.js'

const JWT_SECRET = 'test-jwt-secret-for-supabase-auth'

vi.mock('../env.js', () => ({
  env: {
    SUPABASE_JWT_SECRET: 'test-jwt-secret-for-supabase-auth',
  },
}))

async function signJwt(payload: Record<string, unknown>, options?: { expiresIn?: string; secret?: string }) {
  const secret = new TextEncoder().encode(options?.secret ?? JWT_SECRET)
  const builder = new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()

  if (options?.expiresIn) {
    builder.setExpirationTime(options.expiresIn)
  } else {
    builder.setExpirationTime('1h')
  }

  return builder.sign(secret)
}

type Vars = { userId: string }

function createTestApp() {
  const app = new Hono<{ Variables: Vars }>()
  app.onError(errorHandler)
  app.use('/*', authMiddleware)
  app.get('/test', (c) => {
    const userId = c.get('userId')
    return c.json({ userId })
  })
  return app
}

describe('Auth Middleware (Layer 1 — JWT)', () => {
  describe('missing Authorization header', () => {
    it('should return 401 when no Authorization header', async () => {
      const app = createTestApp()
      const res = await app.request('/test')

      expect(res.status).toBe(401)
      const body = (await res.json()) as { error: { message: string } }
      expect(body.error.message).toContain('Missing Authorization')
    })
  })

  describe('invalid Authorization format', () => {
    it('should return 401 for non-Bearer scheme', async () => {
      const app = createTestApp()
      const res = await app.request('/test', {
        headers: { Authorization: 'Basic abc123' },
      })

      expect(res.status).toBe(401)
      const body = (await res.json()) as { error: { message: string } }
      expect(body.error.message).toContain('Invalid Authorization format')
    })

    it('should return 401 for Bearer without token', async () => {
      const app = createTestApp()
      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer' },
      })

      expect(res.status).toBe(401)
    })
  })

  describe('expired JWT', () => {
    it('should return 401 with expired message', async () => {
      const app = createTestApp()
      const token = await signJwt({ sub: 'user-1' }, { expiresIn: '0s' })

      // Wait a tick for the token to expire
      await new Promise((r) => setTimeout(r, 10))

      const res = await app.request('/test', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(401)
      const body = (await res.json()) as { error: { message: string } }
      expect(body.error.message).toContain('expired')
    })
  })

  describe('wrong JWT secret', () => {
    it('should return 401 when signed with different secret', async () => {
      const app = createTestApp()
      const token = await signJwt({ sub: 'user-1' }, { secret: 'wrong-secret-that-is-different!' })

      const res = await app.request('/test', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(401)
      const body = (await res.json()) as { error: { message: string } }
      expect(body.error.message).toContain('Invalid token')
    })
  })

  describe('missing sub claim', () => {
    it('should return 401 when token has no sub', async () => {
      const app = createTestApp()
      const token = await signJwt({ role: 'admin' }) // no sub

      const res = await app.request('/test', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(401)
      const body = (await res.json()) as { error: { message: string } }
      expect(body.error.message).toContain('missing sub')
    })
  })

  describe('valid JWT', () => {
    it('should set userId on context and call next', async () => {
      const app = createTestApp()
      const token = await signJwt({ sub: 'user-123' })

      const res = await app.request('/test', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { userId: string }
      expect(body.userId).toBe('user-123')
    })
  })
})
