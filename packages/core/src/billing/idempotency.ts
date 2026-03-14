/**
 * Idempotency store for webhook event deduplication.
 * In production, use RedisIdempotencyStore. For tests, use InMemoryIdempotencyStore.
 */
export interface IdempotencyStore {
  /** Returns true if the event was already processed */
  has(eventId: string): Promise<boolean>
  /** Marks event as processed with a TTL (seconds) */
  add(eventId: string, ttlSeconds?: number): Promise<void>
}

/** In-memory implementation — for single-instance deployments and tests */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly processed = new Map<string, number>() // eventId → expiresAt timestamp
  private readonly maxSize: number

  constructor(maxSize = 10000) {
    this.maxSize = maxSize
  }

  async has(eventId: string): Promise<boolean> {
    const expiresAt = this.processed.get(eventId)
    if (expiresAt === undefined) return false
    if (Date.now() > expiresAt) {
      this.processed.delete(eventId)
      return false
    }
    return true
  }

  async add(eventId: string, ttlSeconds = 3600): Promise<void> {
    // Evict expired entries if approaching max size
    if (this.processed.size >= this.maxSize) {
      const now = Date.now()
      for (const [key, expiresAt] of this.processed) {
        if (now > expiresAt) this.processed.delete(key)
      }
    }
    // If still at max, evict oldest entries
    if (this.processed.size >= this.maxSize) {
      const keysToDelete = [...this.processed.keys()].slice(0, Math.floor(this.maxSize / 2))
      for (const key of keysToDelete) this.processed.delete(key)
    }
    this.processed.set(eventId, Date.now() + ttlSeconds * 1000)
  }
}
