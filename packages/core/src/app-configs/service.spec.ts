import { describe, expect, it } from 'vitest'
import { AppConfigService } from './service.js'
import type { AppConfigRow, UpdateAppConfigInput } from './repository.js'

// ──────────────────────────────────────────────
// Spy
// ──────────────────────────────────────────────

const DEFAULT_ROW: AppConfigRow = {
  id: 'config-1',
  tenantId: 'tenant-1',
  appName: 'My App',
  iconUrl: null,
  splashUrl: null,
  primaryColor: '#A855F7',
  secondaryColor: '#6366F1',
  menuItems: null,
  storeUrl: null,
  androidPackageName: null,
  iosBundleId: null,
  buildStatus: null,
  lastBuildAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

class AppConfigRepositorySpy {
  findByTenantIdCalls: string[] = []
  findResult: AppConfigRow | undefined = { ...DEFAULT_ROW }

  upsertCalls: Array<{ tenantId: string; input: UpdateAppConfigInput }> = []
  upsertResult: AppConfigRow = { ...DEFAULT_ROW }

  async findByTenantId(tenantId: string) {
    this.findByTenantIdCalls.push(tenantId)
    return this.findResult
  }

  async upsert(tenantId: string, input: UpdateAppConfigInput) {
    this.upsertCalls.push({ tenantId, input })
    return { ...this.upsertResult, ...input }
  }
}

function makeSut() {
  const repo = new AppConfigRepositorySpy()
  const sut = new AppConfigService(repo as unknown as import('./repository.js').AppConfigRepository)
  return { sut, repo }
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('AppConfigService', () => {
  describe('getConfig', () => {
    it('should delegate to repository findByTenantId', async () => {
      const { sut, repo } = makeSut()

      const result = await sut.getConfig('tenant-1')

      expect(repo.findByTenantIdCalls).toEqual(['tenant-1'])
      expect(result?.appName).toBe('My App')
    })

    it('should return undefined when no config exists', async () => {
      const { sut, repo } = makeSut()
      repo.findResult = undefined

      const result = await sut.getConfig('tenant-1')

      expect(result).toBeUndefined()
    })
  })

  describe('updateConfig', () => {
    it('should delegate to repository upsert', async () => {
      const { sut, repo } = makeSut()
      const input: UpdateAppConfigInput = { appName: 'Updated App', primaryColor: '#FF0000' }

      const result = await sut.updateConfig('tenant-1', input)

      expect(repo.upsertCalls).toHaveLength(1)
      expect(repo.upsertCalls[0]).toEqual({ tenantId: 'tenant-1', input })
      expect(result.appName).toBe('Updated App')
      expect(result.primaryColor).toBe('#FF0000')
    })

    it('should return the upserted row', async () => {
      const { sut, repo } = makeSut()
      repo.upsertResult = { ...DEFAULT_ROW, appName: 'New App' }

      const result = await sut.updateConfig('tenant-1', { appName: 'New App' })

      expect(result.appName).toBe('New App')
    })
  })
})
