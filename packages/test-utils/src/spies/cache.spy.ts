import { SpyBase } from './spy-base.js'

export class CacheSpy extends SpyBase {
  private store: Map<string, { value: string; expiresAt: number | null }> = new Map()

  async get(key: string): Promise<string | null> {
    this.trackCall('get', [key])
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.trackCall('set', [key, value, ttlSeconds])
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    })
  }

  async del(key: string): Promise<void> {
    this.trackCall('del', [key])
    this.store.delete(key)
  }

  async exists(key: string): Promise<boolean> {
    this.trackCall('exists', [key])
    const val = await this.get(key)
    return val !== null
  }

  /** Returns the current cache store size */
  size(): number {
    return this.store.size
  }

  override reset(): void {
    super.reset()
    this.store.clear()
  }
}
