import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { IosCertificateValidator, P12Info, ProvisioningInfo } from './validators/ios-certificate.validator';
import { AndroidKeystoreValidator, KeystoreInfo } from './validators/android-keystore.validator';
import type { IosCredentialResponse, AndroidCredentialResponse } from './dto';
import { randomUUID } from 'crypto';

export interface CredentialListItem {
  id: string;
  app_id: string;
  platform: 'ios' | 'android';
  credential_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface IosCredentialData {
  p12: Buffer;
  password: string;
  provisioning: Buffer;
}

interface IosCredentialMetadata {
  teamId: string;
  bundleId: string;
  expiresAt: Date;
  commonName: string;
  isDistribution: boolean;
  isAppStore: boolean;
}

interface AndroidCredentialData {
  keystore: Buffer;
  keystorePassword: string;
  keyAlias: string;
  keyPassword: string;
}

interface AndroidCredentialMetadata {
  keyAlias: string;
  validUntil: Date;
  fingerprintSha256?: string;
}

@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly encryption: EncryptionService,
    private readonly iosValidator: IosCertificateValidator,
    private readonly androidValidator: AndroidKeystoreValidator,
  ) {}

  /**
   * List credentials for an app
   */
  async list(appId: string): Promise<CredentialListItem[]> {
    const credentials = await this.prisma.appCredential.findMany({
      where: { app_id: appId },
      orderBy: { created_at: 'desc' },
    });

    return credentials.map((c) => ({
      id: c.id,
      app_id: c.app_id,
      platform: c.platform as 'ios' | 'android',
      credential_type: c.credential_type,
      metadata: c.metadata as Record<string, unknown>,
      created_at: c.created_at.toISOString(),
      updated_at: c.updated_at.toISOString(),
    }));
  }

  /**
   * Get credential by ID
   */
  async findById(appId: string, credentialId: string): Promise<CredentialListItem> {
    const credential = await this.prisma.appCredential.findFirst({
      where: {
        id: credentialId,
        app_id: appId,
      },
    });

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    return {
      id: credential.id,
      app_id: credential.app_id,
      platform: credential.platform as 'ios' | 'android',
      credential_type: credential.credential_type,
      metadata: credential.metadata as Record<string, unknown>,
      created_at: credential.created_at.toISOString(),
      updated_at: credential.updated_at.toISOString(),
    };
  }

  /**
   * Save iOS credential
   */
  async saveIosCredential(
    appId: string,
    data: IosCredentialData,
    metadata: IosCredentialMetadata,
  ): Promise<IosCredentialResponse> {
    // Delete existing iOS credential if any
    await this.deleteByPlatform(appId, 'ios');

    // Generate unique ID for storage
    const credentialId = randomUUID();
    const storageKey = `credentials/${appId}/ios/${credentialId}.enc`;

    // Pack all credential data together
    const packedData = JSON.stringify({
      p12: data.p12.toString('base64'),
      password: data.password,
      provisioning: data.provisioning.toString('base64'),
    });

    // Encrypt and upload
    const encrypted = this.encryption.encryptPacked(Buffer.from(packedData));
    await this.storage.upload(storageKey, encrypted, {
      contentType: 'application/octet-stream',
    });

    // Save to database
    const credential = await this.prisma.appCredential.create({
      data: {
        id: credentialId,
        app_id: appId,
        platform: 'ios',
        credential_type: 'distribution',
        secret_ref: storageKey,
        metadata: {
          team_id: metadata.teamId,
          bundle_id: metadata.bundleId,
          common_name: metadata.commonName,
          expires_at: metadata.expiresAt.toISOString(),
          is_distribution: metadata.isDistribution,
          is_app_store: metadata.isAppStore,
        },
      },
    });

    this.logger.log(`iOS credential saved for app: ${appId}`);

    return {
      id: credential.id,
      platform: 'ios',
      metadata: {
        team_id: metadata.teamId,
        bundle_id: metadata.bundleId,
        common_name: metadata.commonName,
        expires_at: metadata.expiresAt.toISOString(),
        is_distribution: metadata.isDistribution,
        is_app_store: metadata.isAppStore,
      },
      created_at: credential.created_at.toISOString(),
    };
  }

  /**
   * Save Android credential
   */
  async saveAndroidCredential(
    appId: string,
    data: AndroidCredentialData,
    metadata: AndroidCredentialMetadata,
  ): Promise<AndroidCredentialResponse> {
    // Delete existing Android credential if any
    await this.deleteByPlatform(appId, 'android');

    // Generate unique ID for storage
    const credentialId = randomUUID();
    const storageKey = `credentials/${appId}/android/${credentialId}.enc`;

    // Pack all credential data together
    const packedData = JSON.stringify({
      keystore: data.keystore.toString('base64'),
      keystorePassword: data.keystorePassword,
      keyAlias: data.keyAlias,
      keyPassword: data.keyPassword,
    });

    // Encrypt and upload
    const encrypted = this.encryption.encryptPacked(Buffer.from(packedData));
    await this.storage.upload(storageKey, encrypted, {
      contentType: 'application/octet-stream',
    });

    // Save to database
    const credential = await this.prisma.appCredential.create({
      data: {
        id: credentialId,
        app_id: appId,
        platform: 'android',
        credential_type: 'upload_key',
        secret_ref: storageKey,
        metadata: {
          key_alias: metadata.keyAlias,
          valid_until: metadata.validUntil.toISOString(),
          fingerprint_sha256: metadata.fingerprintSha256,
        },
      },
    });

    this.logger.log(`Android credential saved for app: ${appId}`);

    return {
      id: credential.id,
      platform: 'android',
      metadata: {
        key_alias: metadata.keyAlias,
        valid_until: metadata.validUntil.toISOString(),
        fingerprint_sha256: metadata.fingerprintSha256,
      },
      created_at: credential.created_at.toISOString(),
    };
  }

  /**
   * Download and decrypt credential data (for build process)
   */
  async downloadCredential(
    appId: string,
    platform: 'ios' | 'android',
  ): Promise<IosCredentialData | AndroidCredentialData> {
    const credential = await this.prisma.appCredential.findFirst({
      where: {
        app_id: appId,
        platform,
      },
    });

    if (!credential) {
      throw new NotFoundException(`${platform} credential not found`);
    }

    // Download and decrypt
    const encrypted = await this.storage.download(credential.secret_ref);
    const decrypted = this.encryption.decryptPacked(encrypted);
    const data = JSON.parse(decrypted.toString());

    if (platform === 'ios') {
      return {
        p12: Buffer.from(data.p12, 'base64'),
        password: data.password,
        provisioning: Buffer.from(data.provisioning, 'base64'),
      };
    } else {
      return {
        keystore: Buffer.from(data.keystore, 'base64'),
        keystorePassword: data.keystorePassword,
        keyAlias: data.keyAlias,
        keyPassword: data.keyPassword,
      };
    }
  }

  /**
   * Delete credential by ID
   */
  async delete(appId: string, credentialId: string): Promise<void> {
    const credential = await this.prisma.appCredential.findFirst({
      where: {
        id: credentialId,
        app_id: appId,
      },
    });

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    // Delete from storage
    try {
      await this.storage.delete(credential.secret_ref);
    } catch (error) {
      this.logger.warn(`Failed to delete credential from storage: ${error}`);
    }

    // Delete from database
    await this.prisma.appCredential.delete({
      where: { id: credentialId },
    });

    this.logger.log(`Credential deleted: ${credentialId}`);
  }

  /**
   * Delete all credentials for a platform
   */
  private async deleteByPlatform(
    appId: string,
    platform: 'ios' | 'android',
  ): Promise<void> {
    const credentials = await this.prisma.appCredential.findMany({
      where: {
        app_id: appId,
        platform,
      },
    });

    for (const credential of credentials) {
      try {
        await this.storage.delete(credential.secret_ref);
      } catch {
        // Ignore storage errors
      }
    }

    await this.prisma.appCredential.deleteMany({
      where: {
        app_id: appId,
        platform,
      },
    });
  }

  /**
   * Check if credentials exist for a platform
   */
  async hasCredentials(appId: string, platform: 'ios' | 'android'): Promise<boolean> {
    const count = await this.prisma.appCredential.count({
      where: {
        app_id: appId,
        platform,
      },
    });

    return count > 0;
  }
}
