/**
 * Template Variables Engine — Layer 1 pure functions.
 * Replaces {{variable_name}} with values from a variables map.
 * Zero external dependencies.
 */

import { sanitizeText } from '@appfy/shared'
import { DomainError } from '../errors.js'

/** Known template variables supported in the MVP */
export const KNOWN_VARIABLES = [
  'customer_name',
  'product_name',
  'product_price',
  'product_image_url',
  'order_id',
  'cart_url',
  'store_name',
] as const

export type KnownVariable = (typeof KNOWN_VARIABLES)[number]

/** Variables map: variable name -> value */
export type TemplateVariables = Record<string, string | number>

/** Regex to match template variables: {{variable_name}} with optional spaces */
const TEMPLATE_VAR_REGEX = /\{\{\s*(\w+)\s*\}\}/g

/**
 * Renders a template string by replacing {{variable_name}} with values.
 *
 * - Known variables are replaced with sanitized values
 * - Unknown variables are left as-is (forward compatibility)
 * - Missing REQUIRED variables throw a DomainError
 *
 * @param template - The template string with {{variable}} placeholders
 * @param variables - Map of variable names to their values
 * @param requiredVars - Optional list of variables that MUST be present
 */
export function renderTemplate(
  template: string,
  variables: TemplateVariables,
  requiredVars?: readonly string[],
): string {
  // Check required variables
  if (requiredVars) {
    for (const varName of requiredVars) {
      if (!(varName in variables)) {
        throw new DomainError(
          `Missing required template variable: ${varName}`,
          'TEMPLATE_VARIABLE_MISSING',
        )
      }
    }
  }

  return template.replace(TEMPLATE_VAR_REGEX, (match, varName: string) => {
    if (varName in variables) {
      const value = String(variables[varName])
      // Sanitize XSS in variable values
      return sanitizeText(value)
    }
    // Unknown variable: leave as-is
    return match
  })
}

/**
 * Extracts all variable names from a template string.
 */
export function extractVariables(template: string): string[] {
  const vars: string[] = []
  let match: RegExpExecArray | null
  const regex = new RegExp(TEMPLATE_VAR_REGEX)
  match = regex.exec(template)
  while (match !== null) {
    if (!vars.includes(match[1]!)) {
      vars.push(match[1]!)
    }
    match = regex.exec(template)
  }
  return vars
}

/**
 * Checks if a variable name is a known template variable.
 */
export function isKnownVariable(name: string): name is KnownVariable {
  return KNOWN_VARIABLES.includes(name as KnownVariable)
}
