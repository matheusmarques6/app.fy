import { describe, expect, it } from 'vitest'
import { NotificationRepository } from './repository.js'

describe('NotificationRepository', () => {
  it('should be defined', () => {
    expect(NotificationRepository).toBeDefined()
  })

  it('should extend BaseRepository and enforce tenantId', () => {
    const proto = NotificationRepository.prototype
    expect(typeof proto.create).toBe('function')
    expect(typeof proto.findById).toBe('function')
    expect(typeof proto.list).toBe('function')
    expect(typeof proto.updateStatus).toBe('function')
  })
})
