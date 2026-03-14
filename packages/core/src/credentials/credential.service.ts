import type { EncryptedCredential, EncryptionService } from '../encryption/service.js'
import { EncryptionError } from '../errors.js'

export type CredentialProvider = 'platform' | 'klaviyo' | 'onesignal'

export interface CredentialStoreDeps {
  encryptionService: EncryptionService
  tenantRepo: {
    updateCredentials(
      tenantId: string,
      provider: CredentialProvider,
      encrypted: EncryptedCredential,
    ): Promise<void>
    getCredentials(
      tenantId: string,
      provider: CredentialProvider,
    ): Promise<EncryptedCredential | null>
  }
}

/**
 * Service for storing and retrieving encrypted credentials per tenant.
 * All credentials are encrypted with AES-256-GCM before persistence.
 */
export class CredentialService {
  private readonly encryption: EncryptionService
  private readonly tenantRepo: CredentialStoreDeps['tenantRepo']

  constructor(deps: CredentialStoreDeps) {
    this.encryption = deps.encryptionService
    this.tenantRepo = deps.tenantRepo
  }

  /**
   * Encrypt and store credentials for a tenant + provider.
   */
  async store(tenantId: string, provider: CredentialProvider, plaintext: string): Promise<void> {
    if (!plaintext) {
      throw new EncryptionError('Credential value cannot be empty')
    }

    const encrypted = await this.encryption.encrypt(plaintext)

    // Validate JSONB structure completeness
    if (!encrypted.ct || !encrypted.iv || !encrypted.tag || !encrypted.alg) {
      throw new EncryptionError('Incomplete encrypted credential: missing required fields')
    }

    await this.tenantRepo.updateCredentials(tenantId, provider, encrypted)
  }

  /**
   * Retrieve and decrypt credentials for a tenant + provider.
   * Returns null if no credentials stored.
   */
  async retrieve(tenantId: string, provider: CredentialProvider): Promise<string | null> {
    const encrypted = await this.tenantRepo.getCredentials(tenantId, provider)

    if (!encrypted) return null

    return this.encryption.decrypt(encrypted)
  }
}
