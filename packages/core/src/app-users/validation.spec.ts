import { describe, expect, it } from 'vitest'
import { isValidEmail, validateAppUserInput } from './validation.js'

describe('App User Validation (Layer 1)', () => {
  describe('validateAppUserInput', () => {
    function makeSut(overrides: Parameters<typeof validateAppUserInput>[0] = {}) {
      return validateAppUserInput(overrides)
    }

    it('should return valid for empty input (minimal valid data)', () => {
      const result = makeSut({})
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should return valid for correct email', () => {
      const result = makeSut({ email: 'user@example.com' })
      expect(result.valid).toBe(true)
    })

    it('should return invalid for malformed email', () => {
      const result = makeSut({ email: 'not-an-email' })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid email format')
    })

    it('should return valid for null email', () => {
      const result = makeSut({ email: null })
      expect(result.valid).toBe(true)
    })

    it('should return valid for empty string email', () => {
      const result = makeSut({ email: '' })
      expect(result.valid).toBe(true)
    })

    it('should return invalid for email exceeding 320 chars', () => {
      const longEmail = `${'a'.repeat(310)}@example.com`
      const result = makeSut({ email: longEmail })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Email must be 320 characters or less')
    })

    it('should return invalid for name exceeding 255 chars', () => {
      const result = makeSut({ name: 'a'.repeat(256) })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Name must be 255 characters or less')
    })

    it('should return valid for name at 255 chars', () => {
      const result = makeSut({ name: 'a'.repeat(255) })
      expect(result.valid).toBe(true)
    })

    it('should collect multiple errors', () => {
      const result = makeSut({ email: 'bad', name: 'a'.repeat(256) })
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(2)
    })
  })

  describe('isValidEmail', () => {
    it('should return true for valid email', () => {
      expect(isValidEmail('user@example.com')).toBe(true)
    })

    it('should return false for invalid email', () => {
      expect(isValidEmail('not-valid')).toBe(false)
    })

    it('should return false for too-long email', () => {
      expect(isValidEmail(`${'a'.repeat(310)}@example.com`)).toBe(false)
    })
  })
})
