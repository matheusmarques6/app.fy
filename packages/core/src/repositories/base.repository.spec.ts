import type { Database } from '@appfy/db'
import { describe, expect, it } from 'vitest'
import { MissingTenantIdError } from '../errors.js'
import { BaseRepository } from './base.repository.js'

class TestRepository extends BaseRepository {
  /** Expose protected method for testing */
  validateTenantId(tenantId: string): void {
    this.assertTenantId(tenantId)
  }
}

describe('BaseRepository', () => {
  const fakeDb = {} as Database

  it('should be defined', () => {
    const repo = new TestRepository(fakeDb)
    expect(repo).toBeDefined()
  })

  it('should throw when tenantId is empty string', () => {
    const repo = new TestRepository(fakeDb)
    expect(() => repo.validateTenantId('')).toThrow('tenantId is required')
  })

  it('should throw when tenantId is whitespace only', () => {
    const repo = new TestRepository(fakeDb)
    expect(() => repo.validateTenantId('   ')).toThrow('tenantId is required')
  })

  it('should throw MissingTenantIdError when tenantId is empty string', () => {
    const repo = new TestRepository(fakeDb)
    expect(() => repo.validateTenantId('')).toThrow(MissingTenantIdError)
  })

  it('should throw when tenantId is undefined', () => {
    const repo = new TestRepository(fakeDb)
    // biome-ignore lint/suspicious/noExplicitAny: testing runtime guard with invalid input
    expect(() => repo.validateTenantId(undefined as any)).toThrow('tenantId is required')
  })

  it('should throw when tenantId is null', () => {
    const repo = new TestRepository(fakeDb)
    // biome-ignore lint/suspicious/noExplicitAny: testing runtime guard with invalid input
    expect(() => repo.validateTenantId(null as any)).toThrow('tenantId is required')
  })

  it('should not throw when tenantId is valid', () => {
    const repo = new TestRepository(fakeDb)
    expect(() => repo.validateTenantId('tenant-123')).not.toThrow()
  })
})
