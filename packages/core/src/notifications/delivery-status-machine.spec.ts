import type { DeliveryStatus } from '@appfy/shared'
import { describe, expect, it } from 'vitest'
import { assertValidDeliveryTransition, isValidDeliveryTransition } from './delivery-status-machine.js'

interface Sut {
  readonly isValid: typeof isValidDeliveryTransition
  readonly assertValid: typeof assertValidDeliveryTransition
}

function makeSut(): Sut {
  return {
    isValid: isValidDeliveryTransition,
    assertValid: assertValidDeliveryTransition,
  }
}

describe('Delivery Status Machine (Layer 1)', () => {
  describe('isValidDeliveryTransition', () => {
    const { isValid } = makeSut()

    // All valid forward transitions
    it.each([
      ['pending', 'sent'],
      ['sent', 'delivered'],
      ['delivered', 'opened'],
      ['opened', 'clicked'],
      ['clicked', 'converted'],
    ] satisfies [DeliveryStatus, DeliveryStatus][])(
      'should allow transition from %s to %s',
      (from, to) => {
        // Arrange — inputs provided via parameterization
        // Act
        const result = isValid(from, to)
        // Assert
        expect(result).toBe(true)
      },
    )

    // failed can be reached from any state
    it.each([
      'pending',
      'sent',
      'delivered',
      'opened',
      'clicked',
      'converted',
    ] satisfies DeliveryStatus[])(
      'should allow transition from %s to failed',
      (from) => {
        // Arrange
        const to: DeliveryStatus = 'failed'
        // Act
        const result = isValid(from, to)
        // Assert
        expect(result).toBe(true)
      },
    )

    // Invalid transitions (skipping stages)
    it.each([
      ['pending', 'delivered'],
      ['pending', 'opened'],
      ['pending', 'clicked'],
      ['pending', 'converted'],
      ['sent', 'opened'],
      ['sent', 'clicked'],
      ['sent', 'converted'],
      ['delivered', 'clicked'],
      ['delivered', 'converted'],
      ['opened', 'converted'],
      ['converted', 'pending'],
      ['converted', 'sent'],
      ['failed', 'pending'],
      ['failed', 'sent'],
    ] satisfies [DeliveryStatus, DeliveryStatus][])(
      'should reject transition from %s to %s',
      (from, to) => {
        // Arrange — inputs provided via parameterization
        // Act
        const result = isValid(from, to)
        // Assert
        expect(result).toBe(false)
      },
    )

    // Self-transitions should be invalid
    it.each([
      'pending',
      'sent',
      'delivered',
      'opened',
      'clicked',
      'converted',
      'failed',
    ] satisfies DeliveryStatus[])(
      'should reject self-transition for %s',
      (status) => {
        // Arrange — same from/to
        // Act
        const result = isValid(status, status)
        // Assert
        expect(result).toBe(false)
      },
    )

    // failed is a terminal state (no transitions out except to failed which is self-transition)
    it('should not allow any transition from failed', () => {
      // Arrange
      const nonFailedStatuses: DeliveryStatus[] = ['pending', 'sent', 'delivered', 'opened', 'clicked', 'converted']
      // Act & Assert
      for (const to of nonFailedStatuses) {
        expect(isValid('failed', to)).toBe(false)
      }
    })
  })

  describe('assertValidDeliveryTransition', () => {
    const { assertValid } = makeSut()

    it('should not throw for valid forward transition', () => {
      // Arrange & Act & Assert
      expect(() => assertValid('pending', 'sent')).not.toThrow()
    })

    it('should not throw for transition to failed', () => {
      // Arrange & Act & Assert
      expect(() => assertValid('delivered', 'failed')).not.toThrow()
    })

    it('should throw for invalid transition', () => {
      // Arrange & Act & Assert
      expect(() => assertValid('pending', 'converted')).toThrow('Invalid delivery status transition')
    })

    it('should throw for self-transition', () => {
      // Arrange & Act & Assert
      expect(() => assertValid('sent', 'sent')).toThrow('Invalid delivery status transition')
    })

    it('should include valid targets in error message', () => {
      // Arrange & Act & Assert
      expect(() => assertValid('pending', 'converted')).toThrow('Valid targets:')
    })
  })
})
