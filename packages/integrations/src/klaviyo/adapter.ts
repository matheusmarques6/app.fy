import type { KlaviyoConfig, KlaviyoMetric, KlaviyoProfile, KlaviyoSegment } from './types.js'

/**
 * Klaviyo adapter interface.
 * Separate from PlatformAdapter -- Klaviyo is a read-only data source,
 * not an e-commerce platform.
 */
export interface KlaviyoAdapter {
  getProfiles(): Promise<KlaviyoProfile[]>
  getMetrics(): Promise<KlaviyoMetric[]>
  getSegments(): Promise<KlaviyoSegment[]>
}

/**
 * Klaviyo REST API adapter.
 * Graceful degradation: if Klaviyo is down, the app continues operating.
 */
export class KlaviyoRestAdapter implements KlaviyoAdapter {
  private readonly config: KlaviyoConfig

  constructor(config: KlaviyoConfig) {
    this.config = config
  }

  getProfiles(): Promise<KlaviyoProfile[]> {
    throw new Error(`[Klaviyo:${this.config.apiKey.slice(0, 4)}...] getProfiles not implemented`)
  }

  getMetrics(): Promise<KlaviyoMetric[]> {
    throw new Error(`[Klaviyo:${this.config.apiKey.slice(0, 4)}...] getMetrics not implemented`)
  }

  getSegments(): Promise<KlaviyoSegment[]> {
    throw new Error(`[Klaviyo:${this.config.apiKey.slice(0, 4)}...] getSegments not implemented`)
  }
}
