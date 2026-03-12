import { describe, expect, it } from 'vitest'
import { NotificationService } from './service.js'

describe('NotificationService', () => {
  it('should be defined', () => {
    expect(NotificationService).toBeDefined()
  })

  it('should have the expected method signatures', () => {
    const proto = NotificationService.prototype
    expect(typeof proto.create).toBe('function')
    expect(typeof proto.getById).toBe('function')
    expect(typeof proto.list).toBe('function')
    expect(typeof proto.updateStatus).toBe('function')
    expect(typeof proto.dispatch).toBe('function')
  })
})
