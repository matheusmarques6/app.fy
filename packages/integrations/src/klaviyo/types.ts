/**
 * Klaviyo integration types.
 * READ-ONLY -- consumes data, never writes/modifies campaigns.
 */

export interface KlaviyoConfig {
  readonly apiKey: string
  readonly revision?: string
}

export interface KlaviyoProfile {
  readonly id: string
  readonly email: string
  readonly properties: Record<string, unknown>
}

export interface KlaviyoMetric {
  readonly name: string
  readonly value: number
  readonly timestamp: Date
}

export interface KlaviyoSegment {
  readonly id: string
  readonly name: string
  readonly memberCount: number
}
