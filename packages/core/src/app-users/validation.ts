/**
 * App User domain validation — Layer 1 pure functions.
 * Zero external dependencies.
 */

export interface AppUserValidationInput {
  readonly email?: string | null
  readonly name?: string | null
  readonly externalId?: string | null
}

export interface AppUserValidationResult {
  readonly valid: boolean
  readonly errors: string[]
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Validates app user input fields. Pure function, no side effects. */
export function validateAppUserInput(input: AppUserValidationInput): AppUserValidationResult {
  const errors: string[] = []

  if (input.email !== undefined && input.email !== null && input.email !== '') {
    if (!EMAIL_REGEX.test(input.email)) {
      errors.push('Invalid email format')
    }
    if (input.email.length > 320) {
      errors.push('Email must be 320 characters or less')
    }
  }

  if (input.name !== undefined && input.name !== null) {
    if (input.name.length > 255) {
      errors.push('Name must be 255 characters or less')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/** Checks if an email string is valid */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 320
}
