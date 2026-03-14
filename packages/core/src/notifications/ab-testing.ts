/**
 * A/B Testing Engine — Layer 1 pure functions.
 * Validates splits, calculates winners.
 * Zero external dependencies.
 */

import { DomainError } from '../errors.js'

/** A/B variant configuration */
export interface AbVariantConfig {
  readonly id: string
  readonly title: string
  readonly body: string
}

/** A/B test configuration */
export interface AbTestConfig {
  readonly variants: readonly AbVariantConfig[]
  readonly split: readonly number[]
}

/** Metrics for a single variant */
export interface AbVariantMetrics {
  readonly variantId: string
  readonly deliveries: number
  readonly conversions: number
  readonly conversionRate: number
}

/** Result of A/B test comparison */
export interface AbTestResult {
  readonly winnerId: string | null
  readonly reason: 'winner' | 'tie' | 'insufficient_data'
  readonly metrics: readonly AbVariantMetrics[]
}

/** Minimum deliveries per variant before declaring winner */
const MIN_SAMPLE_SIZE = 100

/** Minimum difference in conversion rate to declare a winner (1%) */
const MIN_DIFFERENCE = 0.01

/**
 * Validates A/B test split percentages.
 * - Max 2 variants in MVP
 * - Split must sum to 100
 */
export function validateAbSplit(config: AbTestConfig): void {
  if (config.variants.length > 2) {
    throw new DomainError('Maximum 2 variants allowed in MVP', 'AB_TEST_INVALID')
  }

  if (config.variants.length < 2) {
    throw new DomainError('A/B test requires exactly 2 variants', 'AB_TEST_INVALID')
  }

  if (config.split.length !== config.variants.length) {
    throw new DomainError('Split must have same length as variants', 'AB_TEST_INVALID')
  }

  const sum = config.split.reduce((a, b) => a + b, 0)
  if (sum !== 100) {
    throw new DomainError(
      `Split must sum to 100%, got ${sum}%`,
      'AB_TEST_INVALID_SPLIT',
    )
  }

  for (const pct of config.split) {
    if (pct < 0 || pct > 100) {
      throw new DomainError('Split percentages must be between 0 and 100', 'AB_TEST_INVALID')
    }
  }
}

/**
 * Creates a default 50/50 split for 2 variants.
 */
export function createDefaultSplit(): readonly number[] {
  return [50, 50]
}

/**
 * Calculates conversion rate for each variant and determines winner.
 *
 * Rules:
 * - Minimum 100 deliveries per variant before declaring winner
 * - Difference < 1% = tie (no winner)
 * - Winner = variant with higher conversion rate
 */
export function calculateAbWinner(
  variantADeliveries: number,
  variantAConversions: number,
  variantBDeliveries: number,
  variantBConversions: number,
  variantAId = 'A',
  variantBId = 'B',
): AbTestResult {
  const rateA = variantADeliveries > 0 ? variantAConversions / variantADeliveries : 0
  const rateB = variantBDeliveries > 0 ? variantBConversions / variantBDeliveries : 0

  const metrics: AbVariantMetrics[] = [
    {
      variantId: variantAId,
      deliveries: variantADeliveries,
      conversions: variantAConversions,
      conversionRate: rateA,
    },
    {
      variantId: variantBId,
      deliveries: variantBDeliveries,
      conversions: variantBConversions,
      conversionRate: rateB,
    },
  ]

  // Insufficient data check
  if (variantADeliveries < MIN_SAMPLE_SIZE || variantBDeliveries < MIN_SAMPLE_SIZE) {
    return {
      winnerId: null,
      reason: 'insufficient_data',
      metrics,
    }
  }

  // Check if difference is significant enough
  const difference = Math.abs(rateA - rateB)
  if (difference < MIN_DIFFERENCE) {
    return {
      winnerId: null,
      reason: 'tie',
      metrics,
    }
  }

  // Determine winner
  const winnerId = rateA > rateB ? variantAId : variantBId
  return {
    winnerId,
    reason: 'winner',
    metrics,
  }
}
