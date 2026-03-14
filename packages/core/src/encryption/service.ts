import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { EncryptionError } from '../errors.js'

/** Encrypted credential stored in JSONB columns */
export interface EncryptedCredential {
  readonly ct: string // ciphertext (base64)
  readonly iv: string // initialization vector (base64)
  readonly tag: string // auth tag (base64)
  readonly alg: 'aes-256-gcm'
}

const ALGORITHM = 'aes-256-gcm' as const
const IV_LENGTH = 12 // 96 bits recommended for GCM
const TAG_LENGTH = 16 // 128 bits

/**
 * AES-256-GCM encryption service for storing sensitive credentials.
 * Uses Node.js crypto module — no external dependencies.
 */
export class EncryptionService {
  private readonly key: Buffer

  constructor(secret: string) {
    if (!secret || secret.length < 32) {
      throw new EncryptionError('Encryption secret must be at least 32 characters')
    }
    // Derive a 32-byte key from the secret using SHA-256
    this.key = createHash('sha256').update(secret).digest()
  }

  async encrypt(plaintext: string): Promise<EncryptedCredential> {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_LENGTH })

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ])

    const tag = cipher.getAuthTag()

    return {
      ct: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      alg: ALGORITHM,
    }
  }

  async decrypt(credential: EncryptedCredential): Promise<string> {
    if (!credential.tag) {
      throw new EncryptionError('Missing auth tag in encrypted credential')
    }

    try {
      const iv = Buffer.from(credential.iv, 'base64')
      const ct = Buffer.from(credential.ct, 'base64')
      const tag = Buffer.from(credential.tag, 'base64')

      const decipher = createDecipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_LENGTH })
      decipher.setAuthTag(tag)

      const decrypted = Buffer.concat([
        decipher.update(ct),
        decipher.final(),
      ])

      return decrypted.toString('utf8')
    } catch (err) {
      if (err instanceof EncryptionError) throw err
      throw new EncryptionError('Decryption failed: invalid ciphertext, key, or auth tag')
    }
  }
}
