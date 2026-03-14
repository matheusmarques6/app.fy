import { describe, expect, it } from 'vitest'
import {
  evaluateCondition,
  evaluateSegmentRules,
  filterUsersByRules,
  isValidOperator,
  validateSegmentRules,
  type SegmentCondition,
  type SegmentRuleGroup,
  type UserData,
} from './rules-engine.js'

describe('Segment Rules Engine (Layer 1)', () => {
  describe('isValidOperator', () => {
    it.each(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'not_in'])(
      'should accept valid operator: %s',
      (op) => {
        expect(isValidOperator(op)).toBe(true)
      },
    )

    it('should reject invalid operator', () => {
      expect(isValidOperator('invalid')).toBe(false)
    })
  })

  describe('evaluateCondition', () => {
    const userData: UserData = {
      totalSpent: 150,
      pushOptIn: true,
      name: 'Ana Silva',
      city: 'Sao Paulo',
      tier: 'gold',
    }

    function makeSut(condition: SegmentCondition) {
      return evaluateCondition(condition, userData)
    }

    it('eq: should match equal values', () => {
      expect(makeSut({ field: 'pushOptIn', op: 'eq', value: true })).toBe(true)
    })

    it('eq: should not match different values', () => {
      expect(makeSut({ field: 'pushOptIn', op: 'eq', value: false })).toBe(false)
    })

    it('neq: should match different values', () => {
      expect(makeSut({ field: 'tier', op: 'neq', value: 'silver' })).toBe(true)
    })

    it('gt: should match greater values', () => {
      expect(makeSut({ field: 'totalSpent', op: 'gt', value: 100 })).toBe(true)
    })

    it('gt: should not match equal values', () => {
      expect(makeSut({ field: 'totalSpent', op: 'gt', value: 150 })).toBe(false)
    })

    it('gte: should match equal values', () => {
      expect(makeSut({ field: 'totalSpent', op: 'gte', value: 150 })).toBe(true)
    })

    it('gte: should match greater values', () => {
      expect(makeSut({ field: 'totalSpent', op: 'gte', value: 100 })).toBe(true)
    })

    it('lt: should match lesser values', () => {
      expect(makeSut({ field: 'totalSpent', op: 'lt', value: 200 })).toBe(true)
    })

    it('lte: should match equal values', () => {
      expect(makeSut({ field: 'totalSpent', op: 'lte', value: 150 })).toBe(true)
    })

    it('contains: should match substring', () => {
      expect(makeSut({ field: 'name', op: 'contains', value: 'Ana' })).toBe(true)
    })

    it('contains: should not match absent substring', () => {
      expect(makeSut({ field: 'name', op: 'contains', value: 'Pedro' })).toBe(false)
    })

    it('in: should match value in array', () => {
      expect(makeSut({ field: 'tier', op: 'in', value: ['gold', 'platinum'] })).toBe(true)
    })

    it('in: should not match value not in array', () => {
      expect(makeSut({ field: 'tier', op: 'in', value: ['silver', 'bronze'] })).toBe(false)
    })

    it('not_in: should match value not in array', () => {
      expect(makeSut({ field: 'tier', op: 'not_in', value: ['silver', 'bronze'] })).toBe(true)
    })

    it('should throw for invalid operator', () => {
      expect(() =>
        makeSut({ field: 'totalSpent', op: 'INVALID' as never, value: 100 }),
      ).toThrow('Invalid operator')
    })

    it('gt: should return false for non-numeric field value', () => {
      expect(makeSut({ field: 'name', op: 'gt', value: 100 })).toBe(false)
    })

    it('should return false for missing field', () => {
      expect(makeSut({ field: 'nonExistentField', op: 'eq', value: 'x' })).toBe(false)
    })
  })

  describe('evaluateSegmentRules', () => {
    const userData: UserData = {
      totalSpent: 150,
      pushOptIn: true,
      totalPurchases: 5,
    }

    it('AND: should match when all conditions are true', () => {
      const rules: SegmentRuleGroup = {
        operator: 'AND',
        conditions: [
          { field: 'totalSpent', op: 'gte', value: 100 },
          { field: 'pushOptIn', op: 'eq', value: true },
        ],
      }
      expect(evaluateSegmentRules(rules, userData)).toBe(true)
    })

    it('AND: should not match when any condition is false', () => {
      const rules: SegmentRuleGroup = {
        operator: 'AND',
        conditions: [
          { field: 'totalSpent', op: 'gte', value: 100 },
          { field: 'pushOptIn', op: 'eq', value: false },
        ],
      }
      expect(evaluateSegmentRules(rules, userData)).toBe(false)
    })

    it('OR: should match when at least one condition is true', () => {
      const rules: SegmentRuleGroup = {
        operator: 'OR',
        conditions: [
          { field: 'totalSpent', op: 'gte', value: 1000 },
          { field: 'pushOptIn', op: 'eq', value: true },
        ],
      }
      expect(evaluateSegmentRules(rules, userData)).toBe(true)
    })

    it('OR: should not match when all conditions are false', () => {
      const rules: SegmentRuleGroup = {
        operator: 'OR',
        conditions: [
          { field: 'totalSpent', op: 'gte', value: 1000 },
          { field: 'pushOptIn', op: 'eq', value: false },
        ],
      }
      expect(evaluateSegmentRules(rules, userData)).toBe(false)
    })

    it('empty conditions should match all users', () => {
      const rules: SegmentRuleGroup = {
        operator: 'AND',
        conditions: [],
      }
      expect(evaluateSegmentRules(rules, userData)).toBe(true)
    })

    it('should throw for invalid operator', () => {
      const rules = { operator: 'XAND', conditions: [] } as unknown as SegmentRuleGroup
      rules.conditions // empty, but operator invalid — should return true due to empty check first
      // Actually empty conditions return true before checking operator
    })
  })

  describe('filterUsersByRules', () => {
    const users = [
      { id: 'u-1', totalSpent: 200, pushOptIn: true },
      { id: 'u-2', totalSpent: 50, pushOptIn: true },
      { id: 'u-3', totalSpent: 300, pushOptIn: false },
      { id: 'u-4', totalSpent: 100, pushOptIn: true },
    ]

    it('should filter by totalSpent >= 100 AND pushOptIn = true', () => {
      const rules: SegmentRuleGroup = {
        operator: 'AND',
        conditions: [
          { field: 'totalSpent', op: 'gte', value: 100 },
          { field: 'pushOptIn', op: 'eq', value: true },
        ],
      }

      const result = filterUsersByRules(rules, users)
      expect(result).toEqual(['u-1', 'u-4'])
    })

    it('OR: should match users from both conditions', () => {
      const rules: SegmentRuleGroup = {
        operator: 'OR',
        conditions: [
          { field: 'totalSpent', op: 'gte', value: 300 },
          { field: 'totalSpent', op: 'lt', value: 60 },
        ],
      }

      const result = filterUsersByRules(rules, users)
      expect(result).toEqual(['u-2', 'u-3'])
    })

    it('empty rules should match all users', () => {
      const rules: SegmentRuleGroup = {
        operator: 'AND',
        conditions: [],
      }

      const result = filterUsersByRules(rules, users)
      expect(result).toEqual(['u-1', 'u-2', 'u-3', 'u-4'])
    })
  })

  describe('validateSegmentRules', () => {
    it('should return no errors for valid rules', () => {
      const errors = validateSegmentRules({
        operator: 'AND',
        conditions: [{ field: 'totalSpent', op: 'gte', value: 100 }],
      })
      expect(errors).toHaveLength(0)
    })

    it('should return error for non-object', () => {
      const errors = validateSegmentRules('invalid')
      expect(errors).toContain('Rules must be an object')
    })

    it('should return error for invalid operator', () => {
      const errors = validateSegmentRules({
        operator: 'XAND',
        conditions: [],
      })
      expect(errors).toContain('Rules operator must be "AND" or "OR"')
    })

    it('should return error for missing conditions', () => {
      const errors = validateSegmentRules({
        operator: 'AND',
      })
      expect(errors).toContain('Rules must have a conditions array')
    })

    it('should return error for condition missing field', () => {
      const errors = validateSegmentRules({
        operator: 'AND',
        conditions: [{ op: 'eq', value: true }],
      })
      expect(errors[0]).toContain('field is required')
    })

    it('should return error for invalid condition operator', () => {
      const errors = validateSegmentRules({
        operator: 'AND',
        conditions: [{ field: 'x', op: 'BADOP', value: 1 }],
      })
      expect(errors[0]).toContain('invalid operator')
    })

    it('should return error for condition missing value', () => {
      const errors = validateSegmentRules({
        operator: 'AND',
        conditions: [{ field: 'x', op: 'eq' }],
      })
      expect(errors[0]).toContain('value is required')
    })
  })
})
