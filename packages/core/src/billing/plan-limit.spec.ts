import { beforeEach, describe, expect, it } from 'vitest'
import { NotificationLimitExceededError } from '../errors.js'
import type { TenantRow } from '../tenants/repository.js'
import { checkPlanLimit, PlanLimitService } from './plan-limit.service.js'

class TenantRepoSpy {
  calls: Record<string, number> = {}
  lastArgs: Record<string, unknown[]> = {}
  private track(m: string, args: unknown[]) { this.calls[m] = (this.calls[m] ?? 0) + 1; this.lastArgs[m] = args }

  async incrementNotificationCount(tenantId: string, amount: number) {
    this.track('incrementNotificationCount', [tenantId, amount])
  }
}

function makeTenant(overrides: Partial<TenantRow> = {}): TenantRow {
  return {
    id: 'tenant-1', name: 'Test', slug: 'test', platform: 'starter',
    onesignalAppId: null, isActive: true, notificationCountCurrentPeriod: 0,
    notificationLimit: 15, stripeCustomerId: null, stripeSubscriptionId: null,
    planId: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

describe('Plan Limits (Layer 1 & 2)', () => {
  describe('checkPlanLimit (Layer 1)', () => {
    it('should allow manual under limit (Starter at 14)', () => {
      const r = checkPlanLimit('manual', 'starter', 14)
      expect(r.allowed).toBe(true)
      expect(r.remaining).toBe(1)
    })

    it('should block manual at limit (Starter at 15)', () => {
      const r = checkPlanLimit('manual', 'starter', 15)
      expect(r.allowed).toBe(false)
      expect(r.remaining).toBe(0)
    })

    it('should block above limit (Starter at 16)', () => {
      expect(checkPlanLimit('manual', 'starter', 16).allowed).toBe(false)
    })

    it('should NEVER block automated (even at limit)', () => {
      expect(checkPlanLimit('automated', 'starter', 999).allowed).toBe(true)
    })

    it('should allow manual for Business (unlimited)', () => {
      const r = checkPlanLimit('manual', 'business', 1000)
      expect(r.allowed).toBe(true)
      expect(r.limit).toBeNull()
    })

    it('should allow manual for Elite (unlimited)', () => {
      expect(checkPlanLimit('manual', 'elite', 5000).allowed).toBe(true)
    })

    it('boundary: limit-1 is allowed', () => {
      expect(checkPlanLimit('manual', 'starter', 14).allowed).toBe(true)
    })

    it('boundary: exactly at limit is blocked', () => {
      expect(checkPlanLimit('manual', 'starter', 15).allowed).toBe(false)
    })

    it('should report correct remaining', () => {
      expect(checkPlanLimit('manual', 'starter', 10).remaining).toBe(5)
    })
  })

  describe('PlanLimitService (Layer 2)', () => {
    let tenantRepo: TenantRepoSpy
    let sut: PlanLimitService
    const tenantId = 'tenant-1'

    function makeSut() {
      tenantRepo = new TenantRepoSpy()
      sut = new PlanLimitService(tenantRepo as never)
    }
    beforeEach(() => makeSut())

    it('should not throw for manual under limit', async () => {
      await expect(sut.assertCanSendNotification(tenantId, 'manual', makeTenant({ notificationCountCurrentPeriod: 10 }))).resolves.not.toThrow()
    })

    it('should throw for manual at limit', async () => {
      await expect(sut.assertCanSendNotification(tenantId, 'manual', makeTenant({ notificationCountCurrentPeriod: 15 }))).rejects.toThrow(NotificationLimitExceededError)
    })

    it('should NOT throw for automated at limit', async () => {
      await expect(sut.assertCanSendNotification(tenantId, 'automated', makeTenant({ notificationCountCurrentPeriod: 999 }))).resolves.not.toThrow()
    })

    it('should not throw for Business plan', async () => {
      await expect(sut.assertCanSendNotification(tenantId, 'manual', makeTenant({ platform: 'business', notificationCountCurrentPeriod: 500 }))).resolves.not.toThrow()
    })

    it('should increment count', async () => {
      await sut.incrementCount(tenantId)
      expect(tenantRepo.calls.incrementNotificationCount).toBe(1)
      expect(tenantRepo.lastArgs.incrementNotificationCount).toEqual([tenantId, 1])
    })

    it('should increment by custom amount', async () => {
      await sut.incrementCount(tenantId, 5)
      expect(tenantRepo.lastArgs.incrementNotificationCount).toEqual([tenantId, 5])
    })
  })
})
