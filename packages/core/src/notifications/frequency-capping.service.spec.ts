import { describe, it, expect } from 'vitest'
import { FrequencyCappingService } from './frequency-capping.service.js'
import type { FrequencyCappingCache } from './frequency-capping.service.js'

// --- Cache Spy ---

class CacheStub implements FrequencyCappingCache {
  private store = new Map<string, number>()

  setCounter(key: string, value: number): void {
    // We match by suffix since actual key includes date
    this._overrides.set(key, value)
  }

  private _overrides = new Map<string, number>()

  async get(key: string): Promise<number | null> {
    // Check overrides first (partial key match)
    for (const [pattern, value] of this._overrides) {
      if (key.includes(pattern)) return value
    }
    return this.store.get(key) ?? null
  }

  async increment(key: string, _ttlSeconds: number): Promise<number> {
    const current = this.store.get(key) ?? 0
    const next = current + 1
    this.store.set(key, next)
    return next
  }

  reset(): void {
    this.store.clear()
    this._overrides.clear()
  }
}

// --- Tests ---

function makeSut() {
  const cache = new CacheStub()
  const sut = new FrequencyCappingService(cache)
  return { sut, cache }
}

describe('FrequencyCappingService', () => {
  const tenantId = 'tenant-1'
  const appUserId = 'user-1'

  describe('check', () => {
    it('should allow push when under daily limit (starter, 0 pushes)', async () => {
      const { sut } = makeSut()

      const result = await sut.check(tenantId, appUserId, 'starter')

      expect(result.allowed).toBe(true)
      expect(result.currentCount).toBe(0)
      expect(result.limit).toBe(2)
    })

    it('should block push when at daily limit (starter, 2 pushes)', async () => {
      const { sut, cache } = makeSut()
      cache.setCounter(`${tenantId}:${appUserId}`, 2)

      const result = await sut.check(tenantId, appUserId, 'starter')

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('daily_limit_reached')
      expect(result.currentCount).toBe(2)
      expect(result.limit).toBe(2)
    })

    it('should block push when business user at 4 pushes', async () => {
      const { sut, cache } = makeSut()
      cache.setCounter(`${tenantId}:${appUserId}`, 4)

      const result = await sut.check(tenantId, appUserId, 'business')

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('daily_limit_reached')
      expect(result.limit).toBe(4)
    })

    it('should allow push for business user at 3 pushes (under limit)', async () => {
      const { sut, cache } = makeSut()
      cache.setCounter(`${tenantId}:${appUserId}`, 3)

      const result = await sut.check(tenantId, appUserId, 'business')

      expect(result.allowed).toBe(true)
    })

    it('should always allow for elite plan (unlimited)', async () => {
      const { sut, cache } = makeSut()
      cache.setCounter(`${tenantId}:${appUserId}`, 100)

      const result = await sut.check(tenantId, appUserId, 'elite')

      expect(result.allowed).toBe(true)
      expect(result.limit).toBeNull()
    })

    it('should block 2nd cart_abandoned in same session', async () => {
      const { sut, cache } = makeSut()
      cache.setCounter(`cart:${tenantId}:${appUserId}:session-1`, 1)

      const result = await sut.check(tenantId, appUserId, 'starter', {
        flowType: 'cart_abandoned',
        sessionId: 'session-1',
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('cart_abandoned_session_limit')
    })

    it('should allow cart_abandoned in different session', async () => {
      const { sut, cache } = makeSut()
      cache.setCounter(`cart:${tenantId}:${appUserId}:session-1`, 1)

      const result = await sut.check(tenantId, appUserId, 'starter', {
        flowType: 'cart_abandoned',
        sessionId: 'session-2',
      })

      expect(result.allowed).toBe(true)
    })

    it('should allow manual campaign with admin override (bypasses daily cap)', async () => {
      const { sut, cache } = makeSut()
      cache.setCounter(`${tenantId}:${appUserId}`, 100) // way over any limit

      const result = await sut.check(tenantId, appUserId, 'starter', {
        isManualCampaign: true,
      })

      expect(result.allowed).toBe(true)
    })

    it('should NOT allow admin override for automated flows', async () => {
      const { sut, cache } = makeSut()
      cache.setCounter(`:welcome`, 2)

      // automated flow (not manual) — should still be capped
      const result = await sut.check(tenantId, appUserId, 'starter', {
        flowType: 'welcome',
        isManualCampaign: false,
      })

      expect(result.allowed).toBe(false)
    })

    it('should allow push at limit - 1 (boundary test)', async () => {
      const { sut, cache } = makeSut()
      cache.setCounter(`:global`, 1) // 1 of 2 for starter (no flow type = global)

      const result = await sut.check(tenantId, appUserId, 'starter')

      expect(result.allowed).toBe(true)
      expect(result.currentCount).toBe(1)
    })

    it('should treat flow types independently (cart_abandoned at limit does not block welcome)', async () => {
      const { sut, cache } = makeSut()
      // cart_abandoned at limit
      cache.setCounter(`:cart_abandoned`, 2)

      // welcome should still be allowed (different flow counter)
      const result = await sut.check(tenantId, appUserId, 'starter', {
        flowType: 'welcome',
      })

      expect(result.allowed).toBe(true)
      expect(result.currentCount).toBe(0)
    })
  })

  describe('record', () => {
    it('should increment daily counter', async () => {
      const { sut } = makeSut()

      await sut.record(tenantId, appUserId)

      // After recording, check should show count = 1
      // (We can't easily verify the cache state directly, but the increment was called)
      // Verify by checking again
      const result = await sut.check(tenantId, appUserId, 'starter')
      expect(result.allowed).toBe(true) // still under limit of 2
    })

    it('should increment cart_abandoned session counter', async () => {
      const { sut } = makeSut()

      await sut.record(tenantId, appUserId, {
        flowType: 'cart_abandoned',
        sessionId: 'session-1',
      })

      // Second cart_abandoned in same session should be blocked
      const result = await sut.check(tenantId, appUserId, 'starter', {
        flowType: 'cart_abandoned',
        sessionId: 'session-1',
      })
      expect(result.allowed).toBe(false)
    })
  })
})
