import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { InMemoryIdempotencyStore } from './idempotency.js'

function makeSut(maxSize?: number) {
  const store = new InMemoryIdempotencyStore(maxSize)
  return { store }
}

describe('InMemoryIdempotencyStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('has() returns false for unknown event', async () => {
    // Arrange
    const { store } = makeSut()

    // Act
    const result = await store.has('evt_unknown')

    // Assert
    expect(result).toBe(false)
  })

  it('has() returns true for added event', async () => {
    // Arrange
    const { store } = makeSut()
    await store.add('evt_123')

    // Act
    const result = await store.has('evt_123')

    // Assert
    expect(result).toBe(true)
  })

  it('adding the same event twice is idempotent', async () => {
    // Arrange
    const { store } = makeSut()

    // Act
    await store.add('evt_dup')
    await store.add('evt_dup')
    const result = await store.has('evt_dup')

    // Assert
    expect(result).toBe(true)
  })

  it('event expires after TTL', async () => {
    // Arrange
    const { store } = makeSut()
    const ttlSeconds = 60

    // Act
    await store.add('evt_ttl', ttlSeconds)

    // Still valid before TTL
    vi.advanceTimersByTime(59_000)
    expect(await store.has('evt_ttl')).toBe(true)

    // Expired after TTL
    vi.advanceTimersByTime(2_000)
    const result = await store.has('evt_ttl')

    // Assert
    expect(result).toBe(false)
  })

  it('max size eviction prevents unbounded growth', async () => {
    // Arrange
    const maxSize = 4
    const { store } = makeSut(maxSize)

    // Act — fill to max
    for (let i = 0; i < maxSize; i++) {
      await store.add(`evt_${i}`)
    }

    // Adding one more triggers eviction (half are removed)
    await store.add('evt_new')

    // Assert — the store accepted the new entry
    expect(await store.has('evt_new')).toBe(true)

    // Some of the oldest entries should have been evicted
    const oldEntriesPresent = await Promise.all(
      Array.from({ length: maxSize }, (_, i) => store.has(`evt_${i}`)),
    )
    const evictedCount = oldEntriesPresent.filter((v) => !v).length
    expect(evictedCount).toBeGreaterThan(0)
  })

  it('expired entries are cleaned up on has() check', async () => {
    // Arrange
    const { store } = makeSut()
    await store.add('evt_expired', 10)

    // Act — advance past TTL
    vi.advanceTimersByTime(11_000)
    const result = await store.has('evt_expired')

    // Assert
    expect(result).toBe(false)

    // Calling has() again should still return false (entry was deleted)
    expect(await store.has('evt_expired')).toBe(false)
  })
})
