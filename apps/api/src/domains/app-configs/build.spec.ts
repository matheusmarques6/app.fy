import type { Dependencies } from '@appfy/core'
import { BuildError } from '@appfy/core'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { BuildStatus } from '@appfy/core'
import { createAppConfigHandlers } from './handlers.js'

// ──────────────────────────────────────────────
// Spies
// ──────────────────────────────────────────────

class AppConfigServiceSpy {
  getConfigResult: unknown = null
  async getConfig() {
    return this.getConfigResult
  }
  async updateConfig(_tenantId: string, input: unknown) {
    return input
  }
}

class BuildServiceSpy {
  triggerBuildCalls: Array<{ tenantId: string; triggeredBy: string }> = []
  triggerBuildResult: { status: BuildStatus } = { status: 'building' }
  triggerBuildError: Error | null = null

  getBuildStatusCalls: string[] = []
  buildStatusResult: { status: BuildStatus; lastBuildAt: Date | null } = {
    status: 'pending',
    lastBuildAt: null,
  }
  buildStatusError: Error | null = null

  async triggerBuild(tenantId: string, triggeredBy: string) {
    this.triggerBuildCalls.push({ tenantId, triggeredBy })
    if (this.triggerBuildError) throw this.triggerBuildError
    return this.triggerBuildResult
  }

  async getBuildStatus(tenantId: string) {
    this.getBuildStatusCalls.push(tenantId)
    if (this.buildStatusError) throw this.buildStatusError
    return this.buildStatusResult
  }
}

// ──────────────────────────────────────────────
// Test helpers
// ──────────────────────────────────────────────

const TENANT_ID = 'tenant-build-test'
const USER_ID = 'user-build-test'

function makeSut() {
  const appConfigService = new AppConfigServiceSpy()
  const buildService = new BuildServiceSpy()

  const deps = {
    appConfigService,
    buildService,
  } as unknown as Dependencies

  const handlers = createAppConfigHandlers(deps)

  const app = new Hono()

  // Inject tenantId and userId into context
  app.use('/*', async (c, next) => {
    c.set('tenantId', TENANT_ID)
    c.set('userId', USER_ID)
    await next()
  })

  app.post('/build', handlers.triggerBuild)
  app.get('/build/status', handlers.buildStatus)

  return { app, buildService }
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('Build Handlers', () => {
  describe('POST /build', () => {
    it('should trigger build and return 201', async () => {
      const { app, buildService } = makeSut()

      const res = await app.request('/build', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(json.data.status).toBe('building')
      expect(buildService.triggerBuildCalls).toHaveLength(1)
      expect(buildService.triggerBuildCalls[0]).toEqual({
        tenantId: TENANT_ID,
        triggeredBy: USER_ID,
      })
    })

    it('should return 400 when build cannot be triggered', async () => {
      const { app, buildService } = makeSut()
      buildService.triggerBuildError = new BuildError('Cannot start build: current status is "building"')

      const res = await app.request('/build', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toContain('Cannot start build')
    })

    it('should return 400 when no app config exists', async () => {
      const { app, buildService } = makeSut()
      buildService.triggerBuildError = new BuildError('App config not found for tenant')

      const res = await app.request('/build', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toContain('App config not found')
    })
  })

  describe('GET /build/status', () => {
    it('should return current build status', async () => {
      const { app, buildService } = makeSut()
      buildService.buildStatusResult = {
        status: 'ready',
        lastBuildAt: new Date('2026-03-14T10:00:00Z'),
      }

      const res = await app.request('/build/status')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.status).toBe('ready')
      expect(json.data.lastBuildAt).toBe('2026-03-14T10:00:00.000Z')
    })

    it('should return pending status when no build has run', async () => {
      const { app } = makeSut()

      const res = await app.request('/build/status')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data.status).toBe('pending')
      expect(json.data.lastBuildAt).toBeNull()
    })

    it('should return 404 when no app config exists', async () => {
      const { app, buildService } = makeSut()
      buildService.buildStatusError = new BuildError('App config not found for tenant')

      const res = await app.request('/build/status')
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toContain('App config not found')
    })
  })

  describe('tenant isolation', () => {
    it('should pass tenantId from context to build service', async () => {
      const { app, buildService } = makeSut()

      await app.request('/build', { method: 'POST' })
      await app.request('/build/status')

      expect(buildService.triggerBuildCalls[0]!.tenantId).toBe(TENANT_ID)
      expect(buildService.getBuildStatusCalls[0]).toBe(TENANT_ID)
    })
  })
})
