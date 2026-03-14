import { describe, expect, it } from 'vitest'
import type { AppConfigRow } from '../app-configs/repository.js'
import { BuildError, BuildService } from './service.js'
import type { AppConfigLookup, BuildQueueAdapter, BuildStatus } from './service.js'

// ──────────────────────────────────────────────
// Spies
// ──────────────────────────────────────────────

class AppConfigLookupSpy implements AppConfigLookup {
  findResult: AppConfigRow | undefined = {
    id: 'config-1',
    tenantId: 'tenant-1',
    appName: 'Test App',
    iconUrl: null,
    splashUrl: null,
    primaryColor: '#A855F7',
    secondaryColor: '#6366F1',
    menuItems: null,
    storeUrl: null,
    androidPackageName: null,
    iosBundleId: null,
    buildStatus: 'pending',
    lastBuildAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  findByTenantIdCalls: string[] = []
  updateBuildStatusCalls: Array<{ tenantId: string; status: BuildStatus }> = []

  async findByTenantId(tenantId: string) {
    this.findByTenantIdCalls.push(tenantId)
    return this.findResult
  }

  async updateBuildStatus(tenantId: string, status: BuildStatus): Promise<AppConfigRow> {
    this.updateBuildStatusCalls.push({ tenantId, status })
    return { ...this.findResult!, buildStatus: status, updatedAt: new Date() }
  }
}

class BuildQueueSpy implements BuildQueueAdapter {
  addedJobs: Array<{ tenantId: string; appConfigId: string; triggeredBy: string }> = []

  async addBuildJob(tenantId: string, appConfigId: string, triggeredBy: string) {
    this.addedJobs.push({ tenantId, appConfigId, triggeredBy })
  }
}

function makeSut() {
  const appConfigLookup = new AppConfigLookupSpy()
  const buildQueue = new BuildQueueSpy()
  const sut = new BuildService({ appConfigLookup, buildQueue })
  return { sut, appConfigLookup, buildQueue }
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('BuildService', () => {
  describe('triggerBuild', () => {
    it('should transition from pending to building and enqueue job', async () => {
      const { sut, appConfigLookup, buildQueue } = makeSut()
      appConfigLookup.findResult = { ...appConfigLookup.findResult!, buildStatus: 'pending' }

      const result = await sut.triggerBuild('tenant-1', 'user-1')

      expect(result.status).toBe('building')
      expect(appConfigLookup.updateBuildStatusCalls).toHaveLength(1)
      expect(appConfigLookup.updateBuildStatusCalls[0]).toEqual({
        tenantId: 'tenant-1',
        status: 'building',
      })
      expect(buildQueue.addedJobs).toHaveLength(1)
      expect(buildQueue.addedJobs[0]).toEqual({
        tenantId: 'tenant-1',
        appConfigId: 'config-1',
        triggeredBy: 'user-1',
      })
    })

    it('should allow rebuilding from ready status', async () => {
      const { sut, appConfigLookup } = makeSut()
      appConfigLookup.findResult = { ...appConfigLookup.findResult!, buildStatus: 'ready' }

      const result = await sut.triggerBuild('tenant-1', 'user-1')

      expect(result.status).toBe('building')
    })

    it('should allow rebuilding from published status', async () => {
      const { sut, appConfigLookup } = makeSut()
      appConfigLookup.findResult = { ...appConfigLookup.findResult!, buildStatus: 'published' }

      const result = await sut.triggerBuild('tenant-1', 'user-1')

      expect(result.status).toBe('building')
    })

    it('should throw when already building', async () => {
      const { sut, appConfigLookup } = makeSut()
      appConfigLookup.findResult = { ...appConfigLookup.findResult!, buildStatus: 'building' }

      await expect(sut.triggerBuild('tenant-1', 'user-1')).rejects.toThrow(BuildError)
      await expect(sut.triggerBuild('tenant-1', 'user-1')).rejects.toThrow(
        'Cannot start build: current status is "building"',
      )
    })

    it('should throw when no app config exists', async () => {
      const { sut, appConfigLookup } = makeSut()
      appConfigLookup.findResult = undefined

      await expect(sut.triggerBuild('tenant-1', 'user-1')).rejects.toThrow(BuildError)
      await expect(sut.triggerBuild('tenant-1', 'user-1')).rejects.toThrow(
        'App config not found for tenant',
      )
    })

    it('should handle null buildStatus as pending', async () => {
      const { sut, appConfigLookup } = makeSut()
      appConfigLookup.findResult = { ...appConfigLookup.findResult!, buildStatus: null as unknown as string }

      const result = await sut.triggerBuild('tenant-1', 'user-1')

      expect(result.status).toBe('building')
    })
  })

  describe('getBuildStatus', () => {
    it('should return current build status', async () => {
      const { sut, appConfigLookup } = makeSut()
      appConfigLookup.findResult = {
        ...appConfigLookup.findResult!,
        buildStatus: 'ready',
        lastBuildAt: new Date('2026-03-14'),
      }

      const result = await sut.getBuildStatus('tenant-1')

      expect(result.status).toBe('ready')
      expect(result.lastBuildAt).toEqual(new Date('2026-03-14'))
    })

    it('should return pending when buildStatus is null', async () => {
      const { sut, appConfigLookup } = makeSut()
      appConfigLookup.findResult = {
        ...appConfigLookup.findResult!,
        buildStatus: null as unknown as string,
        lastBuildAt: null,
      }

      const result = await sut.getBuildStatus('tenant-1')

      expect(result.status).toBe('pending')
      expect(result.lastBuildAt).toBeNull()
    })

    it('should throw when no app config exists', async () => {
      const { sut, appConfigLookup } = makeSut()
      appConfigLookup.findResult = undefined

      await expect(sut.getBuildStatus('tenant-1')).rejects.toThrow(BuildError)
    })
  })

  describe('completeBuild', () => {
    it('should set status to ready on success', async () => {
      const { sut, appConfigLookup } = makeSut()
      appConfigLookup.findResult = { ...appConfigLookup.findResult!, buildStatus: 'building' }

      const result = await sut.completeBuild('tenant-1', true)

      expect(result.status).toBe('ready')
      expect(appConfigLookup.updateBuildStatusCalls[0]).toEqual({
        tenantId: 'tenant-1',
        status: 'ready',
      })
    })

    it('should set status to pending on failure (reset)', async () => {
      const { sut, appConfigLookup } = makeSut()
      appConfigLookup.findResult = { ...appConfigLookup.findResult!, buildStatus: 'building' }

      const result = await sut.completeBuild('tenant-1', false)

      expect(result.status).toBe('pending')
      expect(appConfigLookup.updateBuildStatusCalls[0]).toEqual({
        tenantId: 'tenant-1',
        status: 'pending',
      })
    })

    it('should throw when completing from invalid status', async () => {
      const { sut, appConfigLookup } = makeSut()
      appConfigLookup.findResult = { ...appConfigLookup.findResult!, buildStatus: 'pending' }

      await expect(sut.completeBuild('tenant-1', true)).rejects.toThrow(BuildError)
      await expect(sut.completeBuild('tenant-1', true)).rejects.toThrow(
        'Cannot complete build: current status is "pending"',
      )
    })

    it('should throw when no app config exists', async () => {
      const { sut, appConfigLookup } = makeSut()
      appConfigLookup.findResult = undefined

      await expect(sut.completeBuild('tenant-1', true)).rejects.toThrow(BuildError)
    })
  })

  describe('idempotent build', () => {
    it('same config should produce same transition result', async () => {
      const { sut, appConfigLookup } = makeSut()
      appConfigLookup.findResult = { ...appConfigLookup.findResult!, buildStatus: 'pending' }

      const result1 = await sut.triggerBuild('tenant-1', 'user-1')

      // Reset state for second call
      appConfigLookup.findResult = { ...appConfigLookup.findResult!, buildStatus: 'pending' }
      const result2 = await sut.triggerBuild('tenant-1', 'user-1')

      expect(result1.status).toBe(result2.status)
    })
  })

  describe('status transitions', () => {
    it('should follow valid transition paths', async () => {
      const { sut, appConfigLookup } = makeSut()

      // pending → building
      appConfigLookup.findResult = { ...appConfigLookup.findResult!, buildStatus: 'pending' }
      await expect(sut.triggerBuild('tenant-1', 'user-1')).resolves.toBeDefined()

      // building → ready (via completeBuild)
      appConfigLookup.findResult = { ...appConfigLookup.findResult!, buildStatus: 'building' }
      await expect(sut.completeBuild('tenant-1', true)).resolves.toBeDefined()

      // ready → building (rebuild)
      appConfigLookup.findResult = { ...appConfigLookup.findResult!, buildStatus: 'ready' }
      await expect(sut.triggerBuild('tenant-1', 'user-1')).resolves.toBeDefined()

      // published → building (rebuild)
      appConfigLookup.findResult = { ...appConfigLookup.findResult!, buildStatus: 'published' }
      await expect(sut.triggerBuild('tenant-1', 'user-1')).resolves.toBeDefined()
    })
  })
})
