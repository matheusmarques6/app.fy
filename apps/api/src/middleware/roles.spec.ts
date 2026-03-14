import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { requireRoles } from './roles.js'
import { errorHandler } from './error-handler.js'

type Vars = { userRole: string }

function createTestApp(allowedRoles: string[], currentRole?: string) {
  const app = new Hono<{ Variables: Vars }>()
  app.onError(errorHandler)

  // Simulate previous middleware setting userRole
  app.use('/*', async (c, next) => {
    if (currentRole) {
      c.set('userRole', currentRole)
    }
    await next()
  })

  app.get('/test', requireRoles(...(allowedRoles as never[])), (c) => c.json({ ok: true }))
  return app
}

describe('Roles Middleware RBAC (Layer 1)', () => {
  describe('RBAC matrix — viewer/editor/owner', () => {
    // Owner-only endpoints (DELETE, billing, members)
    describe('owner-only endpoint', () => {
      it('should allow owner', async () => {
        const app = createTestApp(['owner'], 'owner')
        const res = await app.request('/test')
        expect(res.status).toBe(200)
      })

      it('should block editor', async () => {
        const app = createTestApp(['owner'], 'editor')
        const res = await app.request('/test')
        expect(res.status).toBe(403)
      })

      it('should block viewer', async () => {
        const app = createTestApp(['owner'], 'viewer')
        const res = await app.request('/test')
        expect(res.status).toBe(403)
      })
    })

    // Editor + owner endpoints (POST, PUT)
    describe('editor+owner endpoint', () => {
      it('should allow owner', async () => {
        const app = createTestApp(['owner', 'editor'], 'owner')
        const res = await app.request('/test')
        expect(res.status).toBe(200)
      })

      it('should allow editor', async () => {
        const app = createTestApp(['owner', 'editor'], 'editor')
        const res = await app.request('/test')
        expect(res.status).toBe(200)
      })

      it('should block viewer', async () => {
        const app = createTestApp(['owner', 'editor'], 'viewer')
        const res = await app.request('/test')
        expect(res.status).toBe(403)
      })
    })

    // All roles endpoints (GET)
    describe('all-roles endpoint', () => {
      it.each(['owner', 'editor', 'viewer'])('should allow %s', async (role) => {
        const app = createTestApp(['owner', 'editor', 'viewer'], role)
        const res = await app.request('/test')
        expect(res.status).toBe(200)
      })
    })
  })

  describe('no role assigned', () => {
    it('should return 403 when userRole is not set', async () => {
      const app = createTestApp(['owner']) // no role set
      const res = await app.request('/test')

      expect(res.status).toBe(403)
      const body = (await res.json()) as { error: { message: string } }
      expect(body.error.message).toContain('No role')
    })
  })

  describe('error messages', () => {
    it('should include required roles in error message', async () => {
      const app = createTestApp(['owner', 'editor'], 'viewer')
      const res = await app.request('/test')

      const body = (await res.json()) as { error: { message: string } }
      expect(body.error.message).toContain('owner')
      expect(body.error.message).toContain('editor')
    })
  })
})
