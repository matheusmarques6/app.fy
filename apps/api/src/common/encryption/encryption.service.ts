import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt,
} from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export interface EncryptedData {
  /**
   * Encrypted data buffer
   */
  encrypted: Buffer;

  /**
   * Initialization vector (16 bytes for AES-256-GCM)
   */
  iv: Buffer;

  /**
   * Authentication tag (16 bytes for GCM)
   */
  tag: Buffer;
}

export interface PackedEncryptedData {
  /**
   * Packed format: iv (16) + tag (16) + encrypted data
   */
  packed: Buffer;
}

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm' as const;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly key: Buffer | null;
  private readonly isConfigured: boolean;

  constructor(private readonly config: ConfigService) {
    const keyHex = config.get<string>('CREDENTIALS_ENCRYPTION_KEY');

    if (keyHex) {
      const key = Buffer.from(keyHex, 'hex');
      if (key.length !== 32) {
        throw new Error(
          'CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (64 hex characters)',
        );
      }
      this.key = key;
      this.isConfigured = true;
    } else {
      this.key = null;
      this.isConfigured = false;
    }
  }

  onModuleInit() {
    if (!this.isConfigured) {
      this.logger.warn(
        'Encryption service not configured. CREDENTIALS_ENCRYPTION_KEY is required for credential storage.',
      );
    } else {
      this.logger.log('Encryption service initialized');
    }
  }

  /**
   * Check if encryption is properly configured
   */
  isEnabled(): boolean {
    return this.isConfigured;
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(data: Buffer): EncryptedData {
    this.ensureConfigured();

    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, this.key!, iv);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();

    return { encrypted, iv, tag };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(encrypted: Buffer, iv: Buffer, tag: Buffer): Buffer {
    this.ensureConfigured();

    const decipher = createDecipheriv(this.algorithm, this.key!, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  /**
   * Encrypt and pack into a single buffer: iv (16) + tag (16) + encrypted
   */
  encryptPacked(data: Buffer): Buffer {
    const { encrypted, iv, tag } = this.encrypt(data);
    return Buffer.concat([iv, tag, encrypted]);
  }

  /**
   * Unpack and decrypt: extracts iv, tag, and encrypted data from packed buffer
   */
  decryptPacked(packed: Buffer): Buffer {
    if (packed.length < this.ivLength + this.tagLength) {
      throw new Error('Invalid packed encrypted data: too short');
    }

    const iv = packed.subarray(0, this.ivLength);
    const tag = packed.subarray(this.ivLength, this.ivLength + this.tagLength);
    const encrypted = packed.subarray(this.ivLength + this.tagLength);

    return this.decrypt(encrypted, iv, tag);
  }

  /**
   * Encrypt a string and return base64-encoded packed data
   */
  encryptString(plaintext: string): string {
    const data = Buffer.from(plaintext, 'utf-8');
    const packed = this.encryptPacked(data);
    return packed.toString('base64');
  }

  /**
   * Decrypt a base64-encoded packed string
   */
  decryptString(ciphertext: string): string {
    const packed = Buffer.from(ciphertext, 'base64');
    const decrypted = this.decryptPacked(packed);
    return decrypted.toString('utf-8');
  }

  /**
   * Derive a key from a password using scrypt
   * Useful for encrypting data with user-provided passwords
   */
  async deriveKey(
    password: string,
    salt?: Buffer,
  ): Promise<{ key: Buffer; salt: Buffer }> {
    const useSalt = salt || randomBytes(32);
    const derivedKey = (await scryptAsync(password, useSalt, 32)) as Buffer;
    return { key: derivedKey, salt: useSalt };
  }

  /**
   * Encrypt with a derived key from password
   */
  async encryptWithPassword(
    data: Buffer,
    password: string,
  ): Promise<{ packed: Buffer; salt: Buffer }> {
    const { key, salt } = await this.deriveKey(password);

    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, key, iv);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Pack: salt (32) + iv (16) + tag (16) + encrypted
    const packed = Buffer.concat([salt, iv, tag, encrypted]);

    return { packed, salt };
  }

  /**
   * Decrypt with a derived key from password
   */
  async decryptWithPassword(packed: Buffer, password: string): Promise<Buffer> {
    if (packed.length < 32 + this.ivLength + this.tagLength) {
      throw new Error('Invalid packed encrypted data: too short');
    }

    const salt = packed.subarray(0, 32);
    const iv = packed.subarray(32, 32 + this.ivLength);
    const tag = packed.subarray(
      32 + this.ivLength,
      32 + this.ivLength + this.tagLength,
    );
    const encrypted = packed.subarray(32 + this.ivLength + this.tagLength);

    const { key } = await this.deriveKey(password, salt);

    const decipher = createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  /**
   * Ensure encryption is configured before operations
   */
  private ensureConfigured(): void {
    if (!this.isConfigured || !this.key) {
      throw new Error(
        'Encryption service is not configured. Please set CREDENTIALS_ENCRYPTION_KEY.',
      );
    }
  }
}
