import { describe, expect, it } from 'vitest'

import { formatCurrency } from '../currency.js'

describe('formatCurrency', () => {
  const makeSut = () => ({ sut: formatCurrency })

  it('should format BRL by default', () => {
    const { sut } = makeSut()
    const result = sut(127.50)
    expect(result).toContain('127')
    expect(result).toContain('50')
  })

  it('should handle zero', () => {
    const { sut } = makeSut()
    const result = sut(0)
    expect(result).toContain('0')
  })

  it('should handle large values', () => {
    const { sut } = makeSut()
    const result = sut(1_234_567.89)
    expect(result).toContain('1')
    expect(result).toContain('234')
  })

  it('should handle negative values', () => {
    const { sut } = makeSut()
    const result = sut(-50.00)
    expect(result).toContain('50')
  })

  it('should support USD locale', () => {
    const { sut } = makeSut()
    const result = sut(99.99, 'en-US', 'USD')
    expect(result).toContain('$')
    expect(result).toContain('99.99')
  })

  it('should support EUR locale', () => {
    const { sut } = makeSut()
    const result = sut(50.00, 'de-DE', 'EUR')
    expect(result).toContain('50')
  })

  it('should format with 2 decimal places', () => {
    const { sut } = makeSut()
    const result = sut(100, 'en-US', 'USD')
    expect(result).toContain('100.00')
  })
})
