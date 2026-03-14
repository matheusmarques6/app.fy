import { describe, expect, it } from 'vitest'

import { isValidUUID } from '../uuid.js'

describe('isValidUUID', () => {
  const makeSut = () => ({ sut: isValidUUID })

  it('should return true for valid UUID v4', () => {
    const { sut } = makeSut()
    expect(sut('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('should return true for lowercase UUID v4', () => {
    const { sut } = makeSut()
    expect(sut('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')).toBe(true)
  })

  it('should return true for uppercase UUID v4', () => {
    const { sut } = makeSut()
    expect(sut('A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11')).toBe(true)
  })

  it('should return false for empty string', () => {
    const { sut } = makeSut()
    expect(sut('')).toBe(false)
  })

  it('should return false for random string', () => {
    const { sut } = makeSut()
    expect(sut('not-a-uuid')).toBe(false)
  })

  it('should return false for UUID v1 (wrong version digit)', () => {
    const { sut } = makeSut()
    expect(sut('550e8400-e29b-11d4-a716-446655440000')).toBe(false)
  })

  it('should return false for UUID with invalid variant', () => {
    const { sut } = makeSut()
    // variant digit must be 8, 9, a, or b
    expect(sut('550e8400-e29b-41d4-c716-446655440000')).toBe(false)
  })

  it('should return false for UUID without hyphens', () => {
    const { sut } = makeSut()
    expect(sut('550e8400e29b41d4a716446655440000')).toBe(false)
  })

  it('should return false for too-short string', () => {
    const { sut } = makeSut()
    expect(sut('550e8400-e29b-41d4')).toBe(false)
  })

  it('should return false for too-long string', () => {
    const { sut } = makeSut()
    expect(sut('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false)
  })
})
