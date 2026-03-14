/**
 * Segment Rules Engine — Layer 1 pure functions.
 * Evaluates segment rules against user data.
 * Zero external dependencies.
 */

/** Supported comparison operators */
export type RuleOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'not_in'

/** A single condition in a segment rule */
export interface SegmentCondition {
  readonly field: string
  readonly op: RuleOperator
  readonly value: unknown
}

/** A group of conditions combined with AND/OR logic */
export interface SegmentRuleGroup {
  readonly operator: 'AND' | 'OR'
  readonly conditions: readonly SegmentCondition[]
}

/** User data record used for evaluation */
export type UserData = Record<string, unknown>

const VALID_OPERATORS: readonly RuleOperator[] = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'not_in',
]

/** Validates a rule operator */
export function isValidOperator(op: string): op is RuleOperator {
  return VALID_OPERATORS.includes(op as RuleOperator)
}

/**
 * Evaluates a single condition against user data.
 * Returns true if the condition is satisfied.
 */
export function evaluateCondition(condition: SegmentCondition, userData: UserData): boolean {
  if (!isValidOperator(condition.op)) {
    throw new Error(`Invalid operator: ${condition.op}`)
  }

  const fieldValue = userData[condition.field]
  const ruleValue = condition.value

  switch (condition.op) {
    case 'eq':
      return fieldValue === ruleValue
    case 'neq':
      return fieldValue !== ruleValue
    case 'gt':
      return typeof fieldValue === 'number' && typeof ruleValue === 'number' && fieldValue > ruleValue
    case 'gte':
      return typeof fieldValue === 'number' && typeof ruleValue === 'number' && fieldValue >= ruleValue
    case 'lt':
      return typeof fieldValue === 'number' && typeof ruleValue === 'number' && fieldValue < ruleValue
    case 'lte':
      return typeof fieldValue === 'number' && typeof ruleValue === 'number' && fieldValue <= ruleValue
    case 'contains':
      return typeof fieldValue === 'string' && typeof ruleValue === 'string' && fieldValue.includes(ruleValue)
    case 'in':
      return Array.isArray(ruleValue) && ruleValue.includes(fieldValue)
    case 'not_in':
      return Array.isArray(ruleValue) && !ruleValue.includes(fieldValue)
    default:
      return false
  }
}

/**
 * Evaluates a rule group (AND/OR) against user data.
 * - AND: all conditions must be true
 * - OR: at least one condition must be true
 * - Empty rules: matches ALL users (intentional — no filter = everyone)
 */
export function evaluateSegmentRules(rules: SegmentRuleGroup, userData: UserData): boolean {
  if (rules.conditions.length === 0) {
    return true
  }

  if (rules.operator === 'AND') {
    return rules.conditions.every((condition) => evaluateCondition(condition, userData))
  }

  if (rules.operator === 'OR') {
    return rules.conditions.some((condition) => evaluateCondition(condition, userData))
  }

  throw new Error(`Invalid rule group operator: ${rules.operator}`)
}

/**
 * Filters a list of users by segment rules.
 * Returns IDs of matching users.
 */
export function filterUsersByRules(
  rules: SegmentRuleGroup,
  users: Array<{ id: string } & UserData>,
): string[] {
  return users.filter((user) => evaluateSegmentRules(rules, user)).map((user) => user.id)
}

/**
 * Validates a segment rule group structure.
 * Returns error messages if invalid.
 */
export function validateSegmentRules(rules: unknown): string[] {
  const errors: string[] = []

  if (typeof rules !== 'object' || rules === null) {
    return ['Rules must be an object']
  }

  const r = rules as Record<string, unknown>

  if (r.operator !== 'AND' && r.operator !== 'OR') {
    errors.push('Rules operator must be "AND" or "OR"')
  }

  if (!Array.isArray(r.conditions)) {
    errors.push('Rules must have a conditions array')
    return errors
  }

  for (let i = 0; i < r.conditions.length; i++) {
    const cond = r.conditions[i] as Record<string, unknown>
    if (!cond.field || typeof cond.field !== 'string') {
      errors.push(`Condition ${i}: field is required and must be a string`)
    }
    if (!cond.op || typeof cond.op !== 'string') {
      errors.push(`Condition ${i}: op is required and must be a string`)
    } else if (!isValidOperator(cond.op)) {
      errors.push(`Condition ${i}: invalid operator "${cond.op}"`)
    }
    if (cond.value === undefined) {
      errors.push(`Condition ${i}: value is required`)
    }
  }

  return errors
}
