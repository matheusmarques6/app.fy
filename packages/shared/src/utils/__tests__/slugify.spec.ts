import { describe, expect, it } from 'vitest'

import { slugify } from '../format.js'

describe('slugify', () => {
  const makeSut = () => ({ sut: slugify })

  it('should convert to lowercase', () => {
    const { sut } = makeSut()
    expect(sut('Hello World')).toBe('hello-world')
  })

  it('should replace spaces with hyphens', () => {
    const { sut } = makeSut()
    expect(sut('my store name')).toBe('my-store-name')
  })

  it('should remove accents', () => {
    const { sut } = makeSut()
    expect(sut('Notificacao')).toBe('notificacao')
    expect(sut('cafe')).toBe('cafe')
  })

  it('should remove special characters', () => {
    const { sut } = makeSut()
    expect(sut('hello@world!')).toBe('hello-world')
  })

  it('should trim leading and trailing hyphens', () => {
    const { sut } = makeSut()
    expect(sut('--hello--')).toBe('hello')
  })

  it('should collapse multiple hyphens', () => {
    const { sut } = makeSut()
    expect(sut('hello   world')).toBe('hello-world')
  })

  it('should handle empty string', () => {
    const { sut } = makeSut()
    expect(sut('')).toBe('')
  })

  it('should handle strings with only special chars', () => {
    const { sut } = makeSut()
    expect(sut('!!!@@@')).toBe('')
  })

  it('should handle numbers', () => {
    const { sut } = makeSut()
    expect(sut('Product 123')).toBe('product-123')
  })
})
