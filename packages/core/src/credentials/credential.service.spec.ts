import { describe, expect, it, beforeEach } from 'vitest'
import type { EncryptedCredential } from '../encryption/service.js'
import { EncryptionError } from '../errors.js'
import { CredentialService, type CredentialProvider } from './credential.service.js'

class EncryptionServiceSpy {
  encryptCalls: string[] = []
  decryptCalls: EncryptedCredential[] = []
  encryptResult: EncryptedCredential = {
    ct: 'encrypted-ct',
    iv: 'encrypted-iv',
    tag: 'encrypted-tag',
    alg: 'aes-256-gcm',
  }
  decryptResult = 'decrypted-value'
  shouldThrow = false

  async encrypt(plaintext: string): Promise<EncryptedCredential> {
    this.encryptCalls.push(plaintext)
    if (this.shouldThrow) throw new EncryptionError('Encryption failed')
    return this.encryptResult
  }

  async decrypt(credential: EncryptedCredential): Promise<string> {
    this.decryptCalls.push(credential)
    if (this.shouldThrow) throw new EncryptionError('Decryption failed')
    return this.decryptResult
  }
}

class TenantRepoSpy {
  updateCalls: Array<{ tenantId: string; provider: CredentialProvider; encrypted: EncryptedCredential }> = []
  getCalls: Array<{ tenantId: string; provider: CredentialProvider }> = []
  storedCredential: EncryptedCredential | null = null

  async updateCredentials(tenantId: string, provider: CredentialProvider, encrypted: EncryptedCredential) {
    this.updateCalls.push({ tenantId, provider, encrypted })
  }

  async getCredentials(tenantId: string, provider: CredentialProvider): Promise<EncryptedCredential | null> {
    this.getCalls.push({ tenantId, provider })
    return this.storedCredential
  }
}

describe('CredentialService (Layer 2)', () => {
  const tenantId = 'tenant-1'
  let encryptionSpy: EncryptionServiceSpy
  let tenantRepoSpy: TenantRepoSpy
  let sut: CredentialService

  function makeSut() {
    encryptionSpy = new EncryptionServiceSpy()
    tenantRepoSpy = new TenantRepoSpy()
    sut = new CredentialService({
      encryptionService: encryptionSpy as never,
      tenantRepo: tenantRepoSpy,
    })
  }

  beforeEach(() => {
    makeSut()
  })

  describe('store()', () => {
    it('should encrypt and store credentials', async () => {
      await sut.store(tenantId, 'platform', 'my-secret-key')

      expect(encryptionSpy.encryptCalls).toEqual(['my-secret-key'])
      expect(tenantRepoSpy.updateCalls).toHaveLength(1)
      expect(tenantRepoSpy.updateCalls[0]!.tenantId).toBe(tenantId)
      expect(tenantRepoSpy.updateCalls[0]!.provider).toBe('platform')
      expect(tenantRepoSpy.updateCalls[0]!.encrypted).toEqual(encryptionSpy.encryptResult)
    })

    it('should store credentials for different providers', async () => {
      await sut.store(tenantId, 'klaviyo', 'klaviyo-key')
      await sut.store(tenantId, 'onesignal', 'onesignal-key')

      expect(tenantRepoSpy.updateCalls).toHaveLength(2)
      expect(tenantRepoSpy.updateCalls[0]!.provider).toBe('klaviyo')
      expect(tenantRepoSpy.updateCalls[1]!.provider).toBe('onesignal')
    })

    it('should throw when credential value is empty', async () => {
      await expect(sut.store(tenantId, 'platform', '')).rejects.toThrow(EncryptionError)
      await expect(sut.store(tenantId, 'platform', '')).rejects.toThrow('cannot be empty')
    })

    it('should validate encrypted output has all required fields', async () => {
      encryptionSpy.encryptResult = { ct: '', iv: 'iv', tag: 'tag', alg: 'aes-256-gcm' }

      await expect(sut.store(tenantId, 'platform', 'secret')).rejects.toThrow(EncryptionError)
    })
  })

  describe('retrieve()', () => {
    it('should decrypt and return stored credentials', async () => {
      tenantRepoSpy.storedCredential = {
        ct: 'stored-ct',
        iv: 'stored-iv',
        tag: 'stored-tag',
        alg: 'aes-256-gcm',
      }

      const result = await sut.retrieve(tenantId, 'platform')

      expect(result).toBe('decrypted-value')
      expect(encryptionSpy.decryptCalls).toHaveLength(1)
      expect(encryptionSpy.decryptCalls[0]).toEqual(tenantRepoSpy.storedCredential)
    })

    it('should return null when no credentials stored', async () => {
      tenantRepoSpy.storedCredential = null

      const result = await sut.retrieve(tenantId, 'platform')

      expect(result).toBeNull()
      expect(encryptionSpy.decryptCalls).toHaveLength(0)
    })

    it('should propagate decryption errors', async () => {
      tenantRepoSpy.storedCredential = {
        ct: 'bad-ct',
        iv: 'iv',
        tag: 'tag',
        alg: 'aes-256-gcm',
      }
      encryptionSpy.shouldThrow = true

      await expect(sut.retrieve(tenantId, 'platform')).rejects.toThrow(EncryptionError)
    })
  })
})
