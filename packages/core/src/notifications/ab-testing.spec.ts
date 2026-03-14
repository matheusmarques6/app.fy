import { describe, expect, it } from 'vitest'
import { DomainError } from '../errors.js'
import {
  calculateAbWinner,
  createDefaultSplit,
  validateAbSplit,
  type AbTestConfig,
} from './ab-testing.js'

describe('A/B Testing Engine (Layer 1)', () => {
  const variantA = { id: 'A', title: 'Title A', body: 'Body A' }
  const variantB = { id: 'B', title: 'Title B', body: 'Body B' }

  describe('validateAbSplit', () => {
    it('should accept valid 50/50 split', () => {
      const config: AbTestConfig = {
        variants: [variantA, variantB],
        split: [50, 50],
      }
      expect(() => validateAbSplit(config)).not.toThrow()
    })

    it('should accept valid 60/40 split', () => {
      const config: AbTestConfig = {
        variants: [variantA, variantB],
        split: [60, 40],
      }
      expect(() => validateAbSplit(config)).not.toThrow()
    })

    it('should throw when split does not sum to 100', () => {
      const config: AbTestConfig = {
        variants: [variantA, variantB],
        split: [60, 50],
      }
      expect(() => validateAbSplit(config)).toThrow(DomainError)
      expect(() => validateAbSplit(config)).toThrow('sum to 100%')
    })

    it('should throw for more than 2 variants', () => {
      const config: AbTestConfig = {
        variants: [variantA, variantB, { id: 'C', title: 'C', body: 'C' }],
        split: [33, 33, 34],
      }
      expect(() => validateAbSplit(config)).toThrow('Maximum 2 variants')
    })

    it('should throw for less than 2 variants', () => {
      const config: AbTestConfig = {
        variants: [variantA],
        split: [100],
      }
      expect(() => validateAbSplit(config)).toThrow('exactly 2 variants')
    })

    it('should throw when split length mismatches variants', () => {
      const config: AbTestConfig = {
        variants: [variantA, variantB],
        split: [100],
      }
      expect(() => validateAbSplit(config)).toThrow('same length')
    })

    it('should accept [70, 30] split', () => {
      const config: AbTestConfig = {
        variants: [variantA, variantB],
        split: [70, 30],
      }
      expect(() => validateAbSplit(config)).not.toThrow()
    })
  })

  describe('createDefaultSplit', () => {
    it('should return 50/50', () => {
      expect(createDefaultSplit()).toEqual([50, 50])
    })
  })

  describe('calculateAbWinner', () => {
    it('should return insufficient_data when < 100 deliveries (99 A)', () => {
      const result = calculateAbWinner(99, 10, 100, 10)
      expect(result.winnerId).toBeNull()
      expect(result.reason).toBe('insufficient_data')
    })

    it('should return insufficient_data when < 100 deliveries (99 B)', () => {
      const result = calculateAbWinner(100, 10, 99, 10)
      expect(result.winnerId).toBeNull()
      expect(result.reason).toBe('insufficient_data')
    })

    it('boundary: should evaluate at exactly 100 deliveries', () => {
      const result = calculateAbWinner(100, 10, 100, 8)
      expect(result.reason).toBe('winner')
      expect(result.winnerId).toBe('A') // 10% vs 8%
    })

    it('should return tie when difference < 1%', () => {
      // A: 10%, B: 9.5% = 0.5% diff < 1% threshold
      // Use 200 deliveries for integer precision: A=20/200=10%, B=19/200=9.5%
      const result = calculateAbWinner(200, 20, 200, 19)
      expect(result.winnerId).toBeNull()
      expect(result.reason).toBe('tie')
    })

    it('should declare winner when difference >= 1%', () => {
      // A: 10%, B: 8%
      const result = calculateAbWinner(100, 10, 100, 8)
      expect(result.winnerId).toBe('A')
      expect(result.reason).toBe('winner')
    })

    it('should declare B as winner when B has higher rate', () => {
      // A: 5%, B: 10%
      const result = calculateAbWinner(100, 5, 100, 10)
      expect(result.winnerId).toBe('B')
      expect(result.reason).toBe('winner')
    })

    it('should return metrics for both variants', () => {
      const result = calculateAbWinner(100, 10, 100, 8)
      expect(result.metrics).toHaveLength(2)
      expect(result.metrics[0]!.variantId).toBe('A')
      expect(result.metrics[0]!.conversionRate).toBeCloseTo(0.1)
      expect(result.metrics[1]!.variantId).toBe('B')
      expect(result.metrics[1]!.conversionRate).toBeCloseTo(0.08)
    })

    it('should handle zero deliveries (no division by zero)', () => {
      const result = calculateAbWinner(0, 0, 0, 0)
      expect(result.reason).toBe('insufficient_data')
      expect(result.metrics[0]!.conversionRate).toBe(0)
    })

    it('should use custom variant IDs', () => {
      const result = calculateAbWinner(100, 10, 100, 5, 'variant-1', 'variant-2')
      expect(result.winnerId).toBe('variant-1')
    })

    it('boundary: exactly 1% difference should be a winner', () => {
      // A: 10%, B: 9%  => diff = 1% = 0.01, NOT < 0.01
      const result = calculateAbWinner(100, 10, 100, 9)
      expect(result.reason).toBe('winner')
      expect(result.winnerId).toBe('A')
    })

    it('boundary: 0.99% difference should be a tie', () => {
      // A: 10.0%, B: 9.01% => diff = 0.99% < 1%
      // Use 10000 deliveries for precision: A=1000/10000=10%, B=901/10000=9.01%
      const result = calculateAbWinner(10000, 1000, 10000, 901)
      expect(result.reason).toBe('tie')
    })
  })
})
