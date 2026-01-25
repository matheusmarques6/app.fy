import { Injectable, Logger } from '@nestjs/common';
import { generateKeyPairSync, createSign, createVerify, KeyObject } from 'crypto';
import { StorageService } from '../../common/storage/storage.service';
import { EncryptionService } from '../../common/encryption/encryption.service';

export interface KeypairResult {
  /**
   * Base64-encoded public key (for embedding in app)
   */
  publicKey: string;

  /**
   * S3 key where encrypted private key is stored
   */
  privateKeyRef: string;
}

@Injectable()
export class KeypairService {
  private readonly logger = new Logger(KeypairService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Generate a new Ed25519 keypair for Remote Config signing
   */
  async generateKeypair(appId: string): Promise<KeypairResult> {
    this.logger.log(`Generating keypair for app: ${appId}`);

    // Generate Ed25519 keypair
    const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'der' },
    });

    // Encrypt private key
    const encryptedPrivateKey = this.encryption.encryptPacked(privateKey);

    // Upload encrypted private key to S3
    const privateKeyRef = `keypairs/${appId}/private.enc`;
    await this.storage.upload(privateKeyRef, encryptedPrivateKey, {
      contentType: 'application/octet-stream',
    });

    // Return public key as base64
    const publicKeyBase64 = publicKey.toString('base64');

    this.logger.log(`Keypair generated for app: ${appId}`);

    return {
      publicKey: publicKeyBase64,
      privateKeyRef,
    };
  }

  /**
   * Sign a Remote Config payload
   */
  async signConfig(appId: string, configJson: string): Promise<string> {
    // Download and decrypt private key
    const privateKeyRef = `keypairs/${appId}/private.enc`;
    const encryptedPrivateKey = await this.storage.download(privateKeyRef);
    const privateKeyDer = this.encryption.decryptPacked(encryptedPrivateKey);

    // Create private key object
    const privateKey: KeyObject = {
      type: 'private',
      asymmetricKeyType: 'ed25519',
    } as unknown as KeyObject;

    // Sign the config JSON
    const sign = createSign('SHA256');
    sign.update(configJson);

    // For Ed25519, we need to use the DER format directly
    const signature = sign.sign({
      key: Buffer.concat([
        // PKCS8 header for Ed25519
        Buffer.from(privateKeyDer),
      ]),
      format: 'der',
      type: 'pkcs8',
    });

    return signature.toString('base64');
  }

  /**
   * Verify a Remote Config signature (for testing)
   */
  verifyConfig(
    configJson: string,
    signature: string,
    publicKeyBase64: string,
  ): boolean {
    try {
      const publicKeyDer = Buffer.from(publicKeyBase64, 'base64');
      const signatureBuffer = Buffer.from(signature, 'base64');

      const verify = createVerify('SHA256');
      verify.update(configJson);

      return verify.verify(
        {
          key: publicKeyDer,
          format: 'der',
          type: 'spki',
        },
        signatureBuffer,
      );
    } catch (error) {
      this.logger.error(`Signature verification failed: ${error}`);
      return false;
    }
  }

  /**
   * Delete keypair from storage
   */
  async deleteKeypair(appId: string): Promise<void> {
    const privateKeyRef = `keypairs/${appId}/private.enc`;

    try {
      await this.storage.delete(privateKeyRef);
      this.logger.log(`Keypair deleted for app: ${appId}`);
    } catch (error) {
      // Ignore if file doesn't exist
      this.logger.warn(`Failed to delete keypair for app ${appId}: ${error}`);
    }
  }

  /**
   * Check if keypair exists
   */
  async hasKeypair(appId: string): Promise<boolean> {
    const privateKeyRef = `keypairs/${appId}/private.enc`;
    return this.storage.exists(privateKeyRef);
  }
}
