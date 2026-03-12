import { EncryptionError } from '../errors.js'

/** Encrypted credential stored in JSONB columns */
export interface EncryptedCredential {
  readonly ct: string // ciphertext (base64)
  readonly iv: string // initialization vector (base64)
  readonly tag: string // auth tag (base64)
  readonly alg: 'aes-256-gcm'
}

/**
 * AES-256-GCM encryption service for storing sensitive credentials.
 * Uses Node.js crypto module — no external dependencies.
 *
 * Stub — real crypto implementation during TDD.
 */
export class EncryptionService {
  private readonly secret: string

  constructor(secret: string) {
    if (!secret || secret.length < 32) {
      throw new EncryptionError('Encryption secret must be at least 32 characters')
    }
    this.secret = secret
  }

  async encrypt(_plaintext: string): Promise<EncryptedCredential> {
    void this.secret
    throw new EncryptionError('Not implemented')
  }

  async decrypt(_credential: EncryptedCredential): Promise<string> {
    throw new EncryptionError('Not implemented')
  }
}
