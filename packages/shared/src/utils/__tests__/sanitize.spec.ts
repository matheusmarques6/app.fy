import { describe, expect, it } from 'vitest'

import { sanitizeText } from '../sanitize.js'

describe('sanitizeText', () => {
  const makeSut = () => ({ sut: sanitizeText })

  describe('script tag removal', () => {
    it('should strip <script>alert(1)</script>', () => {
      const { sut } = makeSut()
      const result = sut('<script>alert(1)</script>')
      expect(result).not.toContain('<script')
      expect(result).not.toContain('</script')
      expect(result).toBe('alert(1)')
    })

    it('should strip script tags with attributes', () => {
      const { sut } = makeSut()
      const result = sut('<script type="text/javascript">alert(1)</script>')
      expect(result).not.toContain('<script')
      expect(result).toBe('alert(1)')
    })

    it('should strip nested/obfuscated script tags: <scr<script>ipt>', () => {
      const { sut } = makeSut()
      const result = sut('<scr<script>ipt>alert(1)</scr</script>ipt>')
      expect(result).not.toContain('<script')
      expect(result).not.toContain('ipt>')
    })

    it('should strip script tags case-insensitively', () => {
      const { sut } = makeSut()
      const result = sut('<SCRIPT>alert(1)</SCRIPT>')
      expect(result).not.toContain('<SCRIPT')
      expect(result).not.toContain('SCRIPT>')
    })
  })

  describe('img tag removal', () => {
    it('should strip <img onerror="alert(1)">', () => {
      const { sut } = makeSut()
      const result = sut('<img onerror="alert(1)">')
      expect(result).not.toContain('<img')
      expect(result).toBe('')
    })

    it('should strip <img src=x onerror=alert(1)>', () => {
      const { sut } = makeSut()
      const result = sut('<img src=x onerror=alert(1)>')
      expect(result).not.toContain('<img')
      expect(result).toBe('')
    })

    it('should strip img tags even without event handlers', () => {
      const { sut } = makeSut()
      const result = sut('<img src="photo.jpg">')
      expect(result).not.toContain('<img')
    })
  })

  describe('event handler removal', () => {
    it('should strip onload event handler', () => {
      const { sut } = makeSut()
      const result = sut('<div onload="alert(1)">content</div>')
      expect(result).not.toContain('onload')
      expect(result).toContain('content')
    })

    it('should strip onfocus event handler', () => {
      const { sut } = makeSut()
      const result = sut('<input onfocus="alert(1)">')
      expect(result).not.toContain('onfocus')
    })

    it('should strip onmouseover event handler', () => {
      const { sut } = makeSut()
      const result = sut('<span onmouseover="alert(1)">text</span>')
      expect(result).not.toContain('onmouseover')
      expect(result).toContain('text')
    })
  })

  describe('javascript: URI removal', () => {
    it('should strip javascript: protocol', () => {
      const { sut } = makeSut()
      const result = sut('<a href="javascript:alert(1)">click</a>')
      expect(result).not.toContain('javascript:')
      expect(result).toContain('click')
    })

    it('should strip javascript: with spaces', () => {
      const { sut } = makeSut()
      const result = sut('javascript :alert(1)')
      expect(result).not.toMatch(/javascript\s*:/i)
    })
  })

  describe('dangerous tag removal', () => {
    it('should strip iframe tags', () => {
      const { sut } = makeSut()
      const result = sut('<iframe src="evil.com"></iframe>')
      expect(result).not.toContain('<iframe')
      expect(result).not.toContain('</iframe')
    })

    it('should strip embed tags', () => {
      const { sut } = makeSut()
      const result = sut('<embed src="evil.swf">')
      expect(result).not.toContain('<embed')
    })

    it('should strip object tags', () => {
      const { sut } = makeSut()
      const result = sut('<object data="evil.swf"></object>')
      expect(result).not.toContain('<object')
    })

    it('should strip form tags', () => {
      const { sut } = makeSut()
      const result = sut('<form action="evil.com"><input></form>')
      expect(result).not.toContain('<form')
      expect(result).not.toContain('<input')
    })

    it('should strip style tags', () => {
      const { sut } = makeSut()
      const result = sut('<style>body{display:none}</style>')
      expect(result).not.toContain('<style')
    })
  })

  describe('safe content preservation', () => {
    it('should preserve accents (acai, cafe)', () => {
      const { sut } = makeSut()
      expect(sut('acai')).toBe('acai')
      expect(sut('cafe')).toBe('cafe')
      expect(sut('Notificacao')).toBe('Notificacao')
    })

    it('should preserve currency symbols (R$, $, EUR)', () => {
      const { sut } = makeSut()
      expect(sut('R$ 127,00')).toBe('R$ 127,00')
      expect(sut('$99.99')).toBe('$99.99')
      expect(sut('EUR 50')).toBe('EUR 50')
    })

    it('should preserve emojis', () => {
      const { sut } = makeSut()
      expect(sut('Sale! 🎉🚀')).toBe('Sale! 🎉🚀')
    })

    it('should preserve plain text', () => {
      const { sut } = makeSut()
      expect(sut('Hello World')).toBe('Hello World')
    })

    it('should preserve numbers', () => {
      const { sut } = makeSut()
      expect(sut('Order #12345')).toBe('Order #12345')
    })

    it('should handle empty string', () => {
      const { sut } = makeSut()
      expect(sut('')).toBe('')
    })

    it('should preserve mixed safe content with HTML stripped', () => {
      const { sut } = makeSut()
      const result = sut('Promo 🎉 <script>alert(1)</script> R$ 99,90')
      expect(result).toBe('Promo 🎉 alert(1) R$ 99,90')
    })
  })
})
