import { beforeEach, describe, expect, it } from 'vitest'
import type { KlaviyoHttpClient } from './adapter.js'
import { KlaviyoRestAdapter } from './adapter.js'
import type { KlaviyoConfig } from './types.js'

// ── Test Double ──

class KlaviyoHttpClientSpy implements KlaviyoHttpClient {
  calls: Array<{ url: string; headers?: Record<string, string> }> = []
  response: unknown = { data: [] }
  shouldThrow = false

  async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    this.calls.push({ url, headers })
    if (this.shouldThrow) throw new Error('Network error')
    return this.response as T
  }
}

// ── SUT Factory ──

interface Sut {
  adapter: KlaviyoRestAdapter
  httpClient: KlaviyoHttpClientSpy
}

function makeSut(configOverrides?: Partial<KlaviyoConfig>): Sut {
  const httpClient = new KlaviyoHttpClientSpy()
  const config: KlaviyoConfig = {
    apiKey: 'pk_test_abc123',
    ...configOverrides,
  }
  const adapter = new KlaviyoRestAdapter(config, httpClient)
  return { adapter, httpClient }
}

// ── Tests ──

describe('KlaviyoRestAdapter', () => {
  describe('getProfiles', () => {
    it('should call correct URL with auth headers', async () => {
      // Arrange
      const { adapter, httpClient } = makeSut()

      // Act
      await adapter.getProfiles()

      // Assert
      expect(httpClient.calls).toHaveLength(1)
      expect(httpClient.calls[0].url).toBe('https://a.klaviyo.com/api/profiles/')
      expect(httpClient.calls[0].headers).toEqual({
        Authorization: 'Klaviyo-API-Key pk_test_abc123',
        revision: '2024-10-15',
        Accept: 'application/json',
      })
    })

    it('should map Klaviyo response to KlaviyoProfile[]', async () => {
      // Arrange
      const { adapter, httpClient } = makeSut()
      httpClient.response = {
        data: [
          {
            type: 'profile',
            id: 'prof-1',
            attributes: {
              email: 'user@example.com',
              properties: { first_name: 'John' },
            },
          },
          {
            type: 'profile',
            id: 'prof-2',
            attributes: {
              email: 'jane@example.com',
              properties: {},
            },
          },
        ],
      }

      // Act
      const profiles = await adapter.getProfiles()

      // Assert
      expect(profiles).toEqual([
        { id: 'prof-1', email: 'user@example.com', properties: { first_name: 'John' } },
        { id: 'prof-2', email: 'jane@example.com', properties: {} },
      ])
    })

    it('should return empty array when Klaviyo is down (graceful degradation)', async () => {
      // Arrange
      const { adapter, httpClient } = makeSut()
      httpClient.shouldThrow = true

      // Act
      const profiles = await adapter.getProfiles()

      // Assert
      expect(profiles).toEqual([])
    })
  })

  describe('getMetrics', () => {
    it('should call correct URL and map response', async () => {
      // Arrange
      const { adapter, httpClient } = makeSut()
      httpClient.response = {
        data: [
          {
            type: 'metric',
            id: 'metric-1',
            attributes: { name: 'Opened Email' },
          },
        ],
      }

      // Act
      const metrics = await adapter.getMetrics()

      // Assert
      expect(httpClient.calls[0].url).toBe('https://a.klaviyo.com/api/metrics/')
      expect(metrics).toHaveLength(1)
      expect(metrics[0].name).toBe('Opened Email')
      expect(metrics[0].value).toBe(0)
      expect(metrics[0].timestamp).toBeInstanceOf(Date)
    })

    it('should return empty array when Klaviyo is down (graceful degradation)', async () => {
      // Arrange
      const { adapter, httpClient } = makeSut()
      httpClient.shouldThrow = true

      // Act
      const metrics = await adapter.getMetrics()

      // Assert
      expect(metrics).toEqual([])
    })
  })

  describe('getSegments', () => {
    it('should call correct URL and map response', async () => {
      // Arrange
      const { adapter, httpClient } = makeSut()
      httpClient.response = {
        data: [
          {
            type: 'segment',
            id: 'seg-1',
            attributes: { name: 'Active Customers', profile_count: 1500 },
          },
          {
            type: 'segment',
            id: 'seg-2',
            attributes: { name: 'VIP', profile_count: 200 },
          },
        ],
      }

      // Act
      const segments = await adapter.getSegments()

      // Assert
      expect(httpClient.calls[0].url).toBe('https://a.klaviyo.com/api/segments/')
      expect(segments).toEqual([
        { id: 'seg-1', name: 'Active Customers', memberCount: 1500 },
        { id: 'seg-2', name: 'VIP', memberCount: 200 },
      ])
    })

    it('should return empty array when Klaviyo is down (graceful degradation)', async () => {
      // Arrange
      const { adapter, httpClient } = makeSut()
      httpClient.shouldThrow = true

      // Act
      const segments = await adapter.getSegments()

      // Assert
      expect(segments).toEqual([])
    })
  })

  describe('read-only enforcement', () => {
    it('should NEVER make POST/PUT/DELETE requests — only GET calls recorded', async () => {
      // Arrange
      const { adapter, httpClient } = makeSut()

      // Act
      await adapter.getProfiles()
      await adapter.getMetrics()
      await adapter.getSegments()

      // Assert — spy only has a `get` method, proving no write methods exist
      expect(httpClient.calls).toHaveLength(3)
      for (const call of httpClient.calls) {
        expect(call.url).toMatch(/^https:\/\/a\.klaviyo\.com\/api\//)
      }
      // The KlaviyoHttpClient interface only exposes `get` —
      // the adapter has no way to make POST/PUT/DELETE calls
      expect('post' in httpClient).toBe(false)
      expect('put' in httpClient).toBe(false)
      expect('delete' in httpClient).toBe(false)
    })
  })

  describe('revision header', () => {
    it('should use default revision 2024-10-15 when not specified', async () => {
      // Arrange
      const { adapter, httpClient } = makeSut()

      // Act
      await adapter.getProfiles()

      // Assert
      expect(httpClient.calls[0].headers?.revision).toBe('2024-10-15')
    })

    it('should use custom revision when provided', async () => {
      // Arrange
      const { adapter, httpClient } = makeSut({ revision: '2025-01-01' })

      // Act
      await adapter.getProfiles()

      // Assert
      expect(httpClient.calls[0].headers?.revision).toBe('2025-01-01')
    })
  })
})
