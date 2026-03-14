import { Hono } from 'hono'
import * as jose from 'jose'
import { describe, expect, it, vi } from 'vitest'
import { authMiddleware } from './auth.js'
import { createTenantMiddleware } from './tenant.js'
import { requireRoles } from './roles.js'
import { errorHandler } from './error-handler.js'

vi.mock('../env.js', () => ({
  env: {
    SUPABASE_JWT_SECRET: 'chain-test-jwt-secret-32chars!!!',
  },
}))

const JWT_SECRET = 'chain-test-jwt-secret-32chars!!!'

async function signJwt(sub: string) {
  const secret = new TextEncoder().encode(JWT_SECRET)
  return new jose.SignJWT({ sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
}

type Vars = { userId: string; tenantId: string; userRole: string }
type ErrorBody = { error: { code: string; message: string } }
type DataBody = { userId: string; tenantId: string; userRole: string }

function createChainApp(role: string = 'owner') {
  const deps = {
    tenantService: {
      findById: async (id: string) => ({ id, name: 'Test Tenant' }),
    },
    membershipRepo: {
      findByUserAndTenant: async () => ({ role }),
    },
  } as never

  const app = new Hono<{ Variables: Vars }>()
  app.onError(errorHandler)

  const tenantMw = createTenantMiddleware(deps)

  // Protected route with full chain
  app.use('/api/*', authMiddleware, tenantMw)
  app.get('/api/data', (c) => {
    return c.json({
      userId: c.get('userId'),
      tenantId: c.get('tenantId'),
      userRole: c.get('userRole'),
    })
  })
  app.delete('/api/data/:id', requireRoles('owner'), (c) => {
    return c.json({ deleted: true })
  })
  app.post('/api/data', requireRoles('owner', 'editor'), (c) => {
    return c.json({ created: true })
  })

  // Health check without auth
  app.get('/health', (c) => c.json({ status: 'ok' }))

  return app
}

describe('Middleware Chain Integration (Layer 4)', () => {
  describe('chain order: auth → tenant → roles', () => {
    it('should pass full chain for authenticated owner', async () => {
      const app = createChainApp('owner')
      const token = await signJwt('user-1')

      const res = await app.request('/api/data', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': 'tenant-1',
        },
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as DataBody
      expect(body.userId).toBe('user-1')
      expect(body.tenantId).toBe('tenant-1')
      expect(body.userRole).toBe('owner')
    })

    it('should fail at auth (step 1) when no token', async () => {
      const app = createChainApp()

      const res = await app.request('/api/data', {
        headers: { 'X-Tenant-Id': 'tenant-1' },
      })

      expect(res.status).toBe(401)
    })

    it('should fail at tenant (step 2) when no X-Tenant-Id', async () => {
      const app = createChainApp()
      const token = await signJwt('user-1')

      const res = await app.request('/api/data', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
    })

    it('should fail at roles (step 3) when viewer tries DELETE (owner-only)', async () => {
      const app = createChainApp('viewer')
      const token = await signJwt('user-1')

      const res = await app.request('/api/data/123', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': 'tenant-1',
        },
      })

      expect(res.status).toBe(403)
    })

    it('should allow editor for POST (editor+owner)', async () => {
      const app = createChainApp('editor')
      const token = await signJwt('user-1')

      const res = await app.request('/api/data', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': 'tenant-1',
        },
      })

      expect(res.status).toBe(200)
    })
  })

  describe('health check bypasses auth', () => {
    it('should return 200 without any auth headers', async () => {
      const app = createChainApp()
      const res = await app.request('/health')

      expect(res.status).toBe(200)
      const body = (await res.json()) as { status: string }
      expect(body.status).toBe('ok')
    })
  })

  describe('error handler integration', () => {
    it('should return structured error for auth failure', async () => {
      const app = createChainApp()
      const res = await app.request('/api/data')

      const body = (await res.json()) as ErrorBody
      expect(body.error).toBeDefined()
      expect(body.error.code).toBeDefined()
      expect(body.error.message).toBeDefined()
    })
  })
})
