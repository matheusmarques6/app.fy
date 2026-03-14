import { describe, expect, it } from 'vitest'
import { SsrfError, isUrlAllowed, validateUrl } from './ssrf.js'

describe('SSRF Protection (Layer 1)', () => {
  function makeSut() {
    return { validateUrl, isUrlAllowed }
  }

  describe('allowed domains', () => {
    it.each([
      ['https://store.myshopify.com/admin/api/2024-01/products.json'],
      ['https://my-store.myshopify.com/orders'],
      ['https://myshopify.com/admin'],
      ['https://api.nuvemshop.com/v1/products'],
      ['https://store.nuvemshop.com.br/api'],
      ['https://onesignal.com/api/v1/notifications'],
      ['https://api.onesignal.com/notifications'],
      ['https://api.stripe.com/v1/charges'],
      ['https://api.klaviyo.com/v3/events'],
    ])('should allow %s', (url) => {
      const sut = makeSut()
      expect(() => sut.validateUrl(url)).not.toThrow()
      expect(sut.isUrlAllowed(url)).toBe(true)
    })
  })

  describe('blocked private IPs', () => {
    it.each([
      ['http://127.0.0.1:8080/webhook', '127.0.0.1 (loopback)'],
      ['http://10.0.0.1/internal', '10.x (private class A)'],
      ['http://10.255.255.255/test', '10.x boundary'],
      ['http://172.16.0.1/admin', '172.16.x (private class B)'],
      ['http://172.31.255.255/test', '172.31.x boundary'],
      ['http://192.168.1.1/api', '192.168.x (private class C)'],
      ['http://192.168.0.0/test', '192.168.x start'],
      ['http://0.0.0.0/test', '0.0.0.0 (unspecified)'],
    ])('should block %s (%s)', (url) => {
      const sut = makeSut()
      expect(() => sut.validateUrl(url)).toThrow(SsrfError)
      expect(sut.isUrlAllowed(url)).toBe(false)
    })
  })

  describe('blocked localhost variants', () => {
    it.each([
      ['http://[::1]/test', 'IPv6 loopback'],
      ['http://127.0.0.1/', 'IPv4 loopback'],
      ['http://127.0.0.254/', 'loopback range'],
    ])('should block %s (%s)', (url) => {
      const sut = makeSut()
      expect(() => sut.validateUrl(url)).toThrow(SsrfError)
    })
  })

  describe('subdomain spoofing prevention', () => {
    it.each([
      ['https://myshopify.com.evil.com/api', 'shopify spoofing'],
      ['https://nuvemshop.com.evil.com/api', 'nuvemshop spoofing'],
      ['https://evil.com/myshopify.com', 'path-based spoofing'],
      ['https://not-myshopify.com/admin', 'prefix spoofing'],
    ])('should block %s (%s)', (url) => {
      const sut = makeSut()
      expect(() => sut.validateUrl(url)).toThrow(SsrfError)
    })
  })

  describe('invalid URLs', () => {
    it('should throw on invalid URL', () => {
      expect(() => validateUrl('not-a-url')).toThrow(SsrfError)
      expect(() => validateUrl('')).toThrow(SsrfError)
    })

    it('should block non-HTTP protocols', () => {
      expect(() => validateUrl('ftp://myshopify.com/file')).toThrow(SsrfError)
      expect(() => validateUrl('file:///etc/passwd')).toThrow(SsrfError)
    })

    it('should block arbitrary domains', () => {
      expect(() => validateUrl('https://evil.com/api')).toThrow(SsrfError)
      expect(() => validateUrl('https://google.com')).toThrow(SsrfError)
    })
  })
})
