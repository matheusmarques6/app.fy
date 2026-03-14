import type { NotificationStatus } from '@appfy/shared'
import { describe, expect, it } from 'vitest'
import { assertValidTransition, getValidNextStatuses, isValidTransition } from './status-machine.js'

describe('Notification Status Machine (Layer 1)', () => {
  describe('isValidTransition', () => {
    // Valid forward transitions
    it.each([
      ['draft', 'scheduled'],
      ['draft', 'sending'],
      ['scheduled', 'sending'],
      ['sending', 'sent'],
      ['sending', 'failed'],
      ['sent', 'completed'],
      ['sent', 'failed'],
      ['completed', 'failed'],
    ] satisfies [NotificationStatus, NotificationStatus][])(
      'should allow transition from %s to %s',
      (from, to) => {
        expect(isValidTransition(from, to)).toBe(true)
      },
    )

    // failed can be reached from any state
    it.each(['draft', 'scheduled', 'sending', 'sent', 'completed'] satisfies NotificationStatus[])(
      'should allow transition from %s to failed',
      (from) => {
        expect(isValidTransition(from, 'failed')).toBe(true)
      },
    )

    // Invalid transitions (skipping stages)
    it.each([
      ['draft', 'sent'],
      ['draft', 'completed'],
      ['scheduled', 'sent'],
      ['sent', 'draft'],
      ['sent', 'sending'],
      ['completed', 'draft'],
      ['completed', 'sent'],
    ] satisfies [NotificationStatus, NotificationStatus][])(
      'should reject transition from %s to %s',
      (from, to) => {
        expect(isValidTransition(from, to)).toBe(false)
      },
    )

    // Recovery from failed
    it('should allow recovery: failed → draft', () => {
      expect(isValidTransition('failed', 'draft')).toBe(true)
    })

    it('should not allow failed → sent (skip stages)', () => {
      expect(isValidTransition('failed', 'sent')).toBe(false)
    })
  })

  describe('getValidNextStatuses', () => {
    it('should include "failed" for all statuses', () => {
      const statuses: NotificationStatus[] = ['draft', 'scheduled', 'sending', 'sent', 'completed']
      for (const status of statuses) {
        expect(getValidNextStatuses(status)).toContain('failed')
      }
    })

    it('should return correct forward options for draft', () => {
      const next = getValidNextStatuses('draft')
      expect(next).toContain('scheduled')
      expect(next).toContain('sending')
    })
  })

  describe('assertValidTransition', () => {
    it('should not throw for valid transition', () => {
      expect(() => assertValidTransition('draft', 'scheduled')).not.toThrow()
    })

    it('should throw for invalid transition', () => {
      expect(() => assertValidTransition('draft', 'sent')).toThrow('Invalid status transition')
    })

    it('should include valid targets in error message', () => {
      expect(() => assertValidTransition('sent', 'draft')).toThrow('Valid targets:')
    })
  })
})
