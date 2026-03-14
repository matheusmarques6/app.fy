import { describe, expect, it } from 'vitest'
import { DomainError } from '../errors.js'
import {
  extractVariables,
  isKnownVariable,
  KNOWN_VARIABLES,
  renderTemplate,
} from './template-engine.js'

describe('Template Variables Engine (Layer 1)', () => {
  describe('renderTemplate', () => {
    it('should replace known variables', () => {
      const result = renderTemplate('Hello {{customer_name}}!', {
        customer_name: 'Ana',
      })
      expect(result).toBe('Hello Ana!')
    })

    it('should replace multiple variables', () => {
      const result = renderTemplate(
        '{{customer_name}}, your {{product_name}} is ready!',
        {
          customer_name: 'Pedro',
          product_name: 'iPhone 15',
        },
      )
      expect(result).toBe('Pedro, your iPhone 15 is ready!')
    })

    it('should handle variables with spaces: {{ customer_name }}', () => {
      const result = renderTemplate('Hello {{ customer_name }}!', {
        customer_name: 'Ana',
      })
      expect(result).toBe('Hello Ana!')
    })

    it('should leave unknown variables as-is (forward compat)', () => {
      const result = renderTemplate('Hello {{future_var}}!', {
        customer_name: 'Ana',
      })
      expect(result).toBe('Hello {{future_var}}!')
    })

    it('should throw for missing required variable', () => {
      expect(() =>
        renderTemplate('{{product_name}}', {}, ['product_name']),
      ).toThrow(DomainError)
    })

    it('should include variable name in error message', () => {
      expect(() =>
        renderTemplate('{{product_name}}', {}, ['product_name']),
      ).toThrow('product_name')
    })

    it('should sanitize XSS in variable values', () => {
      const result = renderTemplate('Hello {{customer_name}}!', {
        customer_name: '<script>alert(1)</script>Ana',
      })
      expect(result).not.toContain('<script>')
      expect(result).toContain('Ana')
    })

    it('should sanitize img onerror in variable values', () => {
      const result = renderTemplate('Product: {{product_name}}', {
        product_name: '<img onerror="alert(1)" src="x">Phone',
      })
      expect(result).not.toContain('<img')
      expect(result).toContain('Phone')
    })

    it('should preserve safe characters in variable values', () => {
      const result = renderTemplate('Price: {{product_price}}', {
        product_price: 'R$49.90',
      })
      expect(result).toBe('Price: R$49.90')
    })

    it('should preserve accents in variable values', () => {
      const result = renderTemplate('Hello {{customer_name}}', {
        customer_name: 'Joao',
      })
      expect(result).toBe('Hello Joao')
    })

    it('should handle numeric variable values', () => {
      const result = renderTemplate('Order #{{order_id}}', {
        order_id: 12345,
      })
      expect(result).toBe('Order #12345')
    })

    it('should return template as-is when no variables present', () => {
      const result = renderTemplate('Plain text', {})
      expect(result).toBe('Plain text')
    })

    it('should handle template with only variables', () => {
      const result = renderTemplate('{{customer_name}}', {
        customer_name: 'Ana',
      })
      expect(result).toBe('Ana')
    })

    it('should not throw when required list is empty', () => {
      expect(() => renderTemplate('Hello', {}, [])).not.toThrow()
    })
  })

  describe('extractVariables', () => {
    it('should extract all variables from template', () => {
      const vars = extractVariables('{{customer_name}} bought {{product_name}}')
      expect(vars).toEqual(['customer_name', 'product_name'])
    })

    it('should not duplicate variables', () => {
      const vars = extractVariables('{{name}} is {{name}}')
      expect(vars).toEqual(['name'])
    })

    it('should handle templates with no variables', () => {
      const vars = extractVariables('Plain text')
      expect(vars).toEqual([])
    })

    it('should handle variables with spaces', () => {
      const vars = extractVariables('{{ customer_name }}')
      expect(vars).toEqual(['customer_name'])
    })
  })

  describe('isKnownVariable', () => {
    it.each([...KNOWN_VARIABLES])('should recognize known variable: %s', (v) => {
      expect(isKnownVariable(v)).toBe(true)
    })

    it('should reject unknown variable', () => {
      expect(isKnownVariable('unknown_var')).toBe(false)
    })
  })
})
