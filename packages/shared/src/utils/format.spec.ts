import { describe, expect, it } from 'vitest'

import { formatCentsToBrl, slugify, truncate } from './format.js'

describe('formatCentsToBrl', () => {
  it('should format cents to BRL', () => {
    const result = formatCentsToBrl(12700)
    expect(result).toContain('127')
  })

  it('should handle zero', () => {
    const result = formatCentsToBrl(0)
    expect(result).toContain('0')
  })
})

describe('truncate', () => {
  it('should not truncate short strings', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('should truncate long strings with ellipsis', () => {
    const result = truncate('hello world', 6)
    expect(result).toHaveLength(6)
    expect(result.endsWith('\u2026')).toBe(true)
  })
})

describe('slugify', () => {
  it('should slugify a string', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('should remove accents', () => {
    expect(slugify('Notificacao')).toBe('notificacao')
    expect(slugify('cafe')).toBe('cafe')
  })

  it('should trim leading/trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello')
  })
})
