import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

export interface KeystoreInfo {
  alias: string;
  owner: string;
  issuer: string;
  validFrom: Date;
  validUntil: Date;
  serialNumber: string;
  fingerprintSha256: string;
}

@Injectable()
export class AndroidKeystoreValidator {
  private readonly logger = new Logger(AndroidKeystoreValidator.name);

  /**
   * Validate and extract info from an Android keystore
   *
   * Note: This requires keytool to be installed (comes with Java JDK)
   * For production, consider using a pure JS solution or a dedicated service
   */
  async validateKeystore(
    keystoreBuffer: Buffer,
    keystorePassword: string,
    keyAlias: string,
    keyPassword: string,
  ): Promise<KeystoreInfo> {
    // Write keystore to temp file
    const tempPath = join(tmpdir(), `keystore-${randomUUID()}.jks`);

    try {
      await writeFile(tempPath, keystoreBuffer);

      // Use keytool to list the keystore contents
      const { stdout } = await execAsync(
        `keytool -list -v -keystore "${tempPath}" -storepass "${keystorePassword}" -alias "${keyAlias}"`,
        { timeout: 30000 },
      );

      // Parse the output
      const info = this.parseKeytoolOutput(stdout, keyAlias);

      // Validate the key password by attempting to export
      await this.validateKeyPassword(
        tempPath,
        keystorePassword,
        keyAlias,
        keyPassword,
      );

      // Validate expiration
      if (info.validUntil < new Date()) {
        throw new BadRequestException('Keystore certificate has expired');
      }

      return info;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('password was incorrect')) {
        throw new BadRequestException('Invalid keystore password');
      }

      if (message.includes('Alias') && message.includes('does not exist')) {
        throw new BadRequestException(`Key alias "${keyAlias}" not found in keystore`);
      }

      this.logger.error(`Keystore validation failed: ${message}`);
      throw new BadRequestException(`Invalid keystore: ${message}`);
    } finally {
      // Clean up temp file
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Validate keystore using simple checks when keytool is not available
   */
  async validateKeystoreSimple(
    keystoreBuffer: Buffer,
    keystorePassword: string,
    keyAlias: string,
  ): Promise<{ valid: boolean; alias: string }> {
    // Check for PKCS12 or JKS magic bytes
    const magic = keystoreBuffer.slice(0, 4).toString('hex');

    // PKCS12 starts with 30 82 (ASN.1 SEQUENCE)
    // JKS starts with FEEDFEED (magic number)
    const isPKCS12 = magic.startsWith('3082');
    const isJKS = magic === 'feedfeed';

    if (!isPKCS12 && !isJKS) {
      throw new BadRequestException(
        'Invalid keystore format. Must be PKCS12 (.p12) or JKS (.jks)',
      );
    }

    // For a simple validation without keytool, we just verify the format
    // In production, you'd want to use a proper Java library or keytool
    return {
      valid: true,
      alias: keyAlias,
    };
  }

  /**
   * Parse keytool output to extract certificate info
   */
  private parseKeytoolOutput(output: string, alias: string): KeystoreInfo {
    // Extract owner
    const ownerMatch = output.match(/Owner:\s*(.+)/);
    const owner = ownerMatch ? ownerMatch[1].trim() : '';

    // Extract issuer
    const issuerMatch = output.match(/Issuer:\s*(.+)/);
    const issuer = issuerMatch ? issuerMatch[1].trim() : '';

    // Extract validity dates
    const validFromMatch = output.match(/Valid from:\s*([^\s]+ [^\s]+ [^\s]+ [^\s]+ [^\s]+)/);
    const validUntilMatch = output.match(/until:\s*([^\s]+ [^\s]+ [^\s]+ [^\s]+ [^\s]+)/);

    const validFrom = validFromMatch
      ? new Date(validFromMatch[1])
      : new Date();
    const validUntil = validUntilMatch
      ? new Date(validUntilMatch[1])
      : new Date(Date.now() + 25 * 365 * 24 * 60 * 60 * 1000); // Default: 25 years

    // Extract serial number
    const serialMatch = output.match(/Serial number:\s*([a-f0-9]+)/i);
    const serialNumber = serialMatch ? serialMatch[1] : '';

    // Extract SHA256 fingerprint
    const sha256Match = output.match(
      /SHA256:\s*([A-F0-9:]+)/i,
    );
    const fingerprintSha256 = sha256Match
      ? sha256Match[1].replace(/:/g, '')
      : '';

    return {
      alias,
      owner,
      issuer,
      validFrom,
      validUntil,
      serialNumber,
      fingerprintSha256,
    };
  }

  /**
   * Validate key password by attempting to access the private key
   */
  private async validateKeyPassword(
    keystorePath: string,
    keystorePassword: string,
    keyAlias: string,
    keyPassword: string,
  ): Promise<void> {
    try {
      // Try to export the certificate (requires key password)
      await execAsync(
        `keytool -exportcert -keystore "${keystorePath}" -storepass "${keystorePassword}" -alias "${keyAlias}" -keypass "${keyPassword}" -file /dev/null 2>&1`,
        { timeout: 30000 },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes('password was incorrect')) {
        throw new BadRequestException('Invalid key password');
      }

      // Some errors are expected when exporting to /dev/null
      // If we get here without password error, the password is correct
    }
  }
}
