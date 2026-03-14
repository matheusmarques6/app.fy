import { describe, expect, it } from 'vitest'
import { EncryptionError } from '../errors.js'
import type { EncryptedCredential } from './service.js'
import { EncryptionService } from './service.js'

describe('EncryptionService (Layer 1 — AES-256-GCM)', () => {
  const validSecret = 'test-32-char-encryption-secret!!'

  function makeSut(secret = validSecret) {
    return new EncryptionService(secret)
  }

  describe('constructor', () => {
    it('should accept secret with 32+ characters', () => {
      expect(() => makeSut()).not.toThrow()
    })

    it('should reject secret shorter than 32 characters', () => {
      expect(() => makeSut('short')).toThrow(EncryptionError)
      expect(() => makeSut('short')).toThrow('at least 32 characters')
    })

    it('should reject empty secret', () => {
      expect(() => makeSut('')).toThrow(EncryptionError)
    })
  })

  describe('encrypt/decrypt round-trip', () => {
    it('should encrypt and decrypt back to the original plaintext', async () => {
      const sut = makeSut()
      const plaintext = 'my-super-secret-api-key-123'

      const encrypted = await sut.encrypt(plaintext)
      const decrypted = await sut.decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should handle empty string', async () => {
      const sut = makeSut()
      const encrypted = await sut.encrypt('')
      const decrypted = await sut.decrypt(encrypted)
      expect(decrypted).toBe('')
    })

    it('should handle unicode and emojis', async () => {
      const sut = makeSut()
      const plaintext = 'Ação com símbolo € £ ¥ e emoji 🔑'

      const encrypted = await sut.encrypt(plaintext)
      const decrypted = await sut.decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should handle very long strings', async () => {
      const sut = makeSut()
      const plaintext = 'x'.repeat(10_000)

      const encrypted = await sut.encrypt(plaintext)
      const decrypted = await sut.decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })
  })

  describe('encrypted output structure', () => {
    it('should return JSONB with ct, iv, tag, alg fields', async () => {
      const sut = makeSut()
      const encrypted = await sut.encrypt('test')

      expect(encrypted).toHaveProperty('ct')
      expect(encrypted).toHaveProperty('iv')
      expect(encrypted).toHaveProperty('tag')
      expect(encrypted).toHaveProperty('alg')
      expect(encrypted.alg).toBe('aes-256-gcm')
    })

    it('should produce base64-encoded ct, iv, and tag', async () => {
      const sut = makeSut()
      const encrypted = await sut.encrypt('test')

      const base64Regex = /^[A-Za-z0-9+/]+=*$/
      expect(encrypted.ct).toMatch(base64Regex)
      expect(encrypted.iv).toMatch(base64Regex)
      expect(encrypted.tag).toMatch(base64Regex)
    })
  })

  describe('unique IV (same input → different output)', () => {
    it('should produce different ciphertext for the same plaintext (10 runs)', async () => {
      const sut = makeSut()
      const plaintext = 'same-plaintext-every-time'

      const results = await Promise.all(
        Array.from({ length: 10 }, () => sut.encrypt(plaintext)),
      )

      const ciphertexts = results.map((r) => r.ct)
      const uniqueCiphertexts = new Set(ciphertexts)
      expect(uniqueCiphertexts.size).toBe(10)

      const ivs = results.map((r) => r.iv)
      const uniqueIVs = new Set(ivs)
      expect(uniqueIVs.size).toBe(10)
    })
  })

  describe('tamper detection', () => {
    it('should throw on tampered ciphertext', async () => {
      const sut = makeSut()
      const encrypted = await sut.encrypt('secret-value')

      const tampered: EncryptedCredential = {
        ...encrypted,
        ct: Buffer.from('tampered-data').toString('base64'),
      }

      await expect(sut.decrypt(tampered)).rejects.toThrow(EncryptionError)
    })

    it('should throw when auth tag is missing', async () => {
      const sut = makeSut()
      const encrypted = await sut.encrypt('secret-value')

      const noTag = { ct: encrypted.ct, iv: encrypted.iv, alg: encrypted.alg } as EncryptedCredential

      await expect(sut.decrypt(noTag)).rejects.toThrow(EncryptionError)
    })

    it('should throw when auth tag is corrupted', async () => {
      const sut = makeSut()
      const encrypted = await sut.encrypt('secret-value')

      const badTag: EncryptedCredential = {
        ...encrypted,
        tag: Buffer.from('bad-tag-value-123456').toString('base64'),
      }

      await expect(sut.decrypt(badTag)).rejects.toThrow(EncryptionError)
    })
  })

  describe('wrong key rejection', () => {
    it('should throw when decrypting with a different key', async () => {
      const sut1 = makeSut('key-aaaa-bbbb-cccc-dddd-eeee-ffff!')
      const sut2 = makeSut('key-1111-2222-3333-4444-5555-6666!')

      const encrypted = await sut1.encrypt('secret-value')

      await expect(sut2.decrypt(encrypted)).rejects.toThrow(EncryptionError)
    })
  })
})
