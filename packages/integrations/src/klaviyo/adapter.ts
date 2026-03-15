import type { KlaviyoConfig, KlaviyoMetric, KlaviyoProfile, KlaviyoSegment } from './types.js'

/**
 * HTTP client interface for testability.
 * Allows injecting a spy in tests instead of hitting real Klaviyo API.
 */
export interface KlaviyoHttpClient {
  get<T>(url: string, headers?: Record<string, string>): Promise<T>
}

/**
 * Default HTTP client using native fetch.
 * READ-ONLY — only implements GET.
 */
export class KlaviyoFetchClient implements KlaviyoHttpClient {
  async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    const response = await fetch(url, { method: 'GET', ...(headers !== undefined && { headers }) })
    if (!response.ok) {
      throw new Error(`Klaviyo API error: ${response.status} ${response.statusText}`)
    }
    return response.json() as Promise<T>
  }
}

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

// ── Klaviyo API response shapes ──

interface KlaviyoProfileResponse {
  data: Array<{
    type: 'profile'
    id: string
    attributes: {
      email: string
      properties: Record<string, unknown>
    }
  }>
}

interface KlaviyoMetricResponse {
  data: Array<{
    type: 'metric'
    id: string
    attributes: {
      name: string
    }
  }>
}

interface KlaviyoSegmentResponse {
  data: Array<{
    type: 'segment'
    id: string
    attributes: {
      name: string
      profile_count: number
    }
  }>
}

const BASE_URL = 'https://a.klaviyo.com/api'
const DEFAULT_REVISION = '2024-10-15'

/**
 * Klaviyo REST API adapter.
 * READ-ONLY — never writes to Klaviyo.
 * Graceful degradation: if Klaviyo is down, returns empty arrays.
 */
export class KlaviyoRestAdapter implements KlaviyoAdapter {
  private readonly config: KlaviyoConfig
  private readonly httpClient: KlaviyoHttpClient

  constructor(config: KlaviyoConfig, httpClient?: KlaviyoHttpClient) {
    this.config = config
    this.httpClient = httpClient ?? new KlaviyoFetchClient()
  }

  async getProfiles(): Promise<KlaviyoProfile[]> {
    try {
      const response = await this.httpClient.get<KlaviyoProfileResponse>(
        `${BASE_URL}/profiles/`,
        this.buildHeaders(),
      )
      return response.data.map((item) => ({
        id: item.id,
        email: item.attributes.email,
        properties: item.attributes.properties,
      }))
    } catch {
      return []
    }
  }

  async getMetrics(): Promise<KlaviyoMetric[]> {
    try {
      const response = await this.httpClient.get<KlaviyoMetricResponse>(
        `${BASE_URL}/metrics/`,
        this.buildHeaders(),
      )
      return response.data.map((item) => ({
        name: item.attributes.name,
        value: 0,
        timestamp: new Date(),
      }))
    } catch {
      return []
    }
  }

  async getSegments(): Promise<KlaviyoSegment[]> {
    try {
      const response = await this.httpClient.get<KlaviyoSegmentResponse>(
        `${BASE_URL}/segments/`,
        this.buildHeaders(),
      )
      return response.data.map((item) => ({
        id: item.id,
        name: item.attributes.name,
        memberCount: item.attributes.profile_count,
      }))
    } catch {
      return []
    }
  }

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Klaviyo-API-Key ${this.config.apiKey}`,
      revision: this.config.revision ?? DEFAULT_REVISION,
      Accept: 'application/json',
    }
  }
}
