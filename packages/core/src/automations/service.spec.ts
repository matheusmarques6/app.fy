import type { FlowType } from '@appfy/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { AutomationNotFoundError } from '../errors.js'
import type { AutomationConfigRow, UpdateAutomationInput } from './repository.js'
import { AutomationService } from './service.js'

function makeConfig(overrides: Partial<AutomationConfigRow> = {}): AutomationConfigRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tenantId: overrides.tenantId ?? 'tenant-1',
    flowType: overrides.flowType ?? 'cart_abandoned',
    isEnabled: overrides.isEnabled ?? true,
    delaySeconds: overrides.delaySeconds ?? 3600,
    templateTitle: overrides.templateTitle ?? 'Title',
    templateBody: overrides.templateBody ?? 'Body',
    createdAt: new Date(), updatedAt: new Date(),
  }
}

class AutoRepoSpy {
  result: AutomationConfigRow | undefined = undefined
  listResult: AutomationConfigRow[] = []
  calls: Record<string, number> = {}
  lastArgs: Record<string, unknown[]> = {}
  private track(m: string, args: unknown[]) { this.calls[m] = (this.calls[m] ?? 0) + 1; this.lastArgs[m] = args }

  async findByFlow(t: string, ft: FlowType) { this.track('findByFlow', [t, ft]); return this.result }
  async listByTenant(t: string) { this.track('listByTenant', [t]); return this.listResult }
  async update(t: string, ft: FlowType, input: UpdateAutomationInput): Promise<AutomationConfigRow> {
    this.track('update', [t, ft, input])
    return this.result ?? makeConfig({ tenantId: t, flowType: ft })
  }
  async toggleEnabled(t: string, ft: FlowType, enabled: boolean) {
    this.track('toggleEnabled', [t, ft, enabled])
  }
}

describe('AutomationService (Layer 2)', () => {
  const tenantId = 'tenant-1'
  let repo: AutoRepoSpy
  let sut: AutomationService

  function makeSut() { repo = new AutoRepoSpy(); sut = new AutomationService(repo as never) }
  beforeEach(() => makeSut())

  describe('getConfig', () => {
    it('should return config for existing flow', async () => {
      repo.result = makeConfig({ tenantId, flowType: 'cart_abandoned' })
      expect((await sut.getConfig(tenantId, 'cart_abandoned')).flowType).toBe('cart_abandoned')
    })
    it('should throw AutomationNotFoundError', async () => {
      repo.result = undefined
      await expect(sut.getConfig(tenantId, 'cart_abandoned')).rejects.toThrow(AutomationNotFoundError)
    })
  })

  describe('listConfigs', () => {
    it('should return all configs', async () => {
      repo.listResult = [makeConfig({ flowType: 'cart_abandoned' }), makeConfig({ flowType: 'welcome' })]
      expect(await sut.listConfigs(tenantId)).toHaveLength(2)
    })
  })

  describe('updateConfig', () => {
    it('should update delay', async () => {
      repo.result = makeConfig({ tenantId, flowType: 'cart_abandoned' })
      await sut.updateConfig(tenantId, 'cart_abandoned', { delaySeconds: 7200 })
      expect(repo.calls.update).toBe(1)
    })
    it('should update template', async () => {
      repo.result = makeConfig({ tenantId, flowType: 'welcome' })
      await sut.updateConfig(tenantId, 'welcome', { templateTitle: 'New', templateBody: 'Body' })
      expect(repo.calls.update).toBe(1)
    })
    it('should throw if not found', async () => {
      repo.result = undefined
      await expect(sut.updateConfig(tenantId, 'cart_abandoned', { delaySeconds: 7200 })).rejects.toThrow(AutomationNotFoundError)
    })
  })

  describe('toggleEnabled', () => {
    it('should toggle on', async () => {
      repo.result = makeConfig({ tenantId, flowType: 'cart_abandoned', isEnabled: false })
      await sut.toggleEnabled(tenantId, 'cart_abandoned', true)
      expect(repo.calls.toggleEnabled).toBe(1)
      expect(repo.lastArgs.toggleEnabled).toEqual([tenantId, 'cart_abandoned', true])
    })
    it('should throw if not found', async () => {
      repo.result = undefined
      await expect(sut.toggleEnabled(tenantId, 'cart_abandoned', true)).rejects.toThrow(AutomationNotFoundError)
    })
  })
})
