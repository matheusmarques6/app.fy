import { TenantNotFoundError } from '@appfy/core'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { createTenantMiddleware } from './tenant.js'
import { errorHandler } from './error-handler.js'

class TenantServiceSpy {
  findByIdResult: { id: string; name: string } | undefined = undefined
  shouldThrow = false

  async findById(tenantId: string) {
    if (this.shouldThrow) {
      throw new TenantNotFoundError(tenantId)
    }
    return this.findByIdResult
  }
}

class MembershipRepoSpy {
  findResult: { role: string } | null = null

  async findByUserAndTenant(_tenantId: string, _userId: string) {
    return this.findResult
  }
}

type Vars = { userId: string; tenantId: string; userRole: string }

function createTestApp(tenantService: TenantServiceSpy, membershipRepo: MembershipRepoSpy) {
  const app = new Hono<{ Variables: Vars }>()
  app.onError(errorHandler)

  // Simulate authMiddleware setting userId
  app.use('/*', async (c, next) => {
    c.set('userId', 'user-1')
    await next()
  })

  const tenantMw = createTenantMiddleware({
    tenantService,
    membershipRepo,
  } as never)

  app.use('/*', tenantMw)
  app.get('/test', (c) => {
    return c.json({
      tenantId: c.get('tenantId'),
      userRole: c.get('userRole'),
    })
  })
  return app
}

describe('Tenant Middleware (Layer 1)', () => {
  let tenantService: TenantServiceSpy
  let membershipRepo: MembershipRepoSpy

  function makeSut() {
    tenantService = new TenantServiceSpy()
    membershipRepo = new MembershipRepoSpy()
    return createTestApp(tenantService, membershipRepo)
  }

  describe('missing X-Tenant-Id header', () => {
    it('should return 400 when header is missing', async () => {
      const app = makeSut()
      const res = await app.request('/test')

      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: { message: string } }
      expect(body.error.message).toContain('Missing X-Tenant-Id')
    })
  })

  describe('tenant not found', () => {
    it('should return 403 when tenant does not exist', async () => {
      const app = makeSut()
      tenantService.shouldThrow = true

      const res = await app.request('/test', {
        headers: { 'X-Tenant-Id': 'nonexistent-tenant' },
      })

      expect(res.status).toBe(403)
    })
  })

  describe('no membership', () => {
    it('should return 403 when user is not a member', async () => {
      const app = makeSut()
      tenantService.findByIdResult = { id: 'tenant-1', name: 'Test' }
      membershipRepo.findResult = null

      const res = await app.request('/test', {
        headers: { 'X-Tenant-Id': 'tenant-1' },
      })

      expect(res.status).toBe(403)
      const body = (await res.json()) as { error: { message: string } }
      expect(body.error.message).toContain('access denied')
    })
  })

  describe('valid tenant + membership', () => {
    it('should set tenantId and userRole on context', async () => {
      const app = makeSut()
      tenantService.findByIdResult = { id: 'tenant-1', name: 'Test' }
      membershipRepo.findResult = { role: 'editor' }

      const res = await app.request('/test', {
        headers: { 'X-Tenant-Id': 'tenant-1' },
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { tenantId: string; userRole: string }
      expect(body.tenantId).toBe('tenant-1')
      expect(body.userRole).toBe('editor')
    })

    it.each(['owner', 'editor', 'viewer'] as const)('should pass through with role=%s', async (role) => {
      const app = makeSut()
      tenantService.findByIdResult = { id: 'tenant-1', name: 'Test' }
      membershipRepo.findResult = { role }

      const res = await app.request('/test', {
        headers: { 'X-Tenant-Id': 'tenant-1' },
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { userRole: string }
      expect(body.userRole).toBe(role)
    })
  })
})
