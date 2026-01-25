import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as forge from 'node-forge';

export interface P12Info {
  commonName: string;
  teamId: string;
  expiresAt: Date;
  serialNumber: string;
  isDistribution: boolean;
}

export interface ProvisioningInfo {
  name: string;
  appIdName: string;
  bundleId: string;
  teamId: string;
  teamName: string;
  expiresAt: Date;
  isAppStore: boolean;
}

@Injectable()
export class IosCertificateValidator {
  private readonly logger = new Logger(IosCertificateValidator.name);

  /**
   * Validate and extract info from a P12 certificate file
   */
  validateP12(p12Buffer: Buffer, password: string): P12Info {
    try {
      // Parse P12
      const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

      // Extract certificate
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = certBags[forge.pki.oids.certBag];

      if (!certBag || certBag.length === 0 || !certBag[0].cert) {
        throw new BadRequestException('No certificate found in P12 file');
      }

      const cert = certBag[0].cert;

      // Extract certificate info
      const commonName = cert.subject.getField('CN')?.value || '';
      const teamId = this.extractTeamId(cert);
      const expiresAt = cert.validity.notAfter;
      const serialNumber = cert.serialNumber;

      // Check if it's a distribution certificate
      const isDistribution = commonName.includes('Distribution');

      // Validate expiration
      if (expiresAt < new Date()) {
        throw new BadRequestException('Certificate has expired');
      }

      // Check if it's expiring soon (within 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      if (expiresAt < thirtyDaysFromNow) {
        this.logger.warn(`Certificate expires soon: ${expiresAt.toISOString()}`);
      }

      // Verify private key exists
      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];

      if (!keyBag || keyBag.length === 0) {
        throw new BadRequestException('No private key found in P12 file');
      }

      return {
        commonName,
        teamId,
        expiresAt,
        serialNumber,
        isDistribution,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);

      if (
        message.includes('Invalid password') ||
        message.includes('PKCS#12 MAC could not be verified')
      ) {
        throw new BadRequestException('Invalid certificate password');
      }

      this.logger.error(`P12 validation failed: ${message}`);
      throw new BadRequestException(`Invalid P12 file: ${message}`);
    }
  }

  /**
   * Validate and extract info from a provisioning profile
   */
  validateProvisioning(provisioningBuffer: Buffer): ProvisioningInfo {
    try {
      // Provisioning profiles are CMS signed plist files
      // We need to extract the plist from the CMS wrapper
      const content = provisioningBuffer.toString('utf-8');

      // Find the plist content between the CMS signature
      const plistStart = content.indexOf('<?xml');
      const plistEnd = content.indexOf('</plist>') + '</plist>'.length;

      if (plistStart === -1 || plistEnd <= plistStart) {
        throw new BadRequestException('Invalid provisioning profile format');
      }

      const plistContent = content.substring(plistStart, plistEnd);

      // Parse plist (simple extraction for key fields)
      const name = this.extractPlistValue(plistContent, 'Name');
      const appIdName = this.extractPlistValue(plistContent, 'AppIDName');
      const teamId = this.extractPlistArray(plistContent, 'TeamIdentifier')[0] || '';
      const teamName = this.extractPlistValue(plistContent, 'TeamName');

      // Extract bundle ID from application-identifier entitlement
      const entitlements = this.extractPlistDict(plistContent, 'Entitlements');
      const applicationIdentifier =
        this.extractPlistValue(entitlements, 'application-identifier') || '';

      // Bundle ID is after the team ID prefix
      const bundleId = applicationIdentifier.replace(`${teamId}.`, '');

      // Extract expiration date
      const expirationDateStr = this.extractPlistValue(
        plistContent,
        'ExpirationDate',
      );
      const expiresAt = new Date(expirationDateStr);

      // Check if it's App Store distribution
      const provisionedDevices = this.extractPlistArray(
        plistContent,
        'ProvisionedDevices',
      );
      const isAppStore = provisionedDevices.length === 0;

      // Validate expiration
      if (expiresAt < new Date()) {
        throw new BadRequestException('Provisioning profile has expired');
      }

      return {
        name,
        appIdName,
        bundleId,
        teamId,
        teamName,
        expiresAt,
        isAppStore,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Provisioning validation failed: ${message}`);
      throw new BadRequestException(`Invalid provisioning profile: ${message}`);
    }
  }

  /**
   * Extract Team ID from certificate (usually in OU field)
   */
  private extractTeamId(cert: forge.pki.Certificate): string {
    // Team ID is typically in the Organizational Unit (OU) field
    const ou = cert.subject.getField('OU');
    if (ou?.value) {
      return ou.value;
    }

    // Fallback: look in extensions
    for (const ext of cert.extensions) {
      if (ext.name === 'subjectAltName' && ext.value) {
        // Parse for team ID pattern
        const match = ext.value.match(/UID=([A-Z0-9]{10})/);
        if (match) {
          return match[1];
        }
      }
    }

    return '';
  }

  /**
   * Simple plist value extraction (for string values)
   */
  private extractPlistValue(plist: string, key: string): string {
    const regex = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`);
    const match = plist.match(regex);
    return match ? match[1] : '';
  }

  /**
   * Extract plist array values
   */
  private extractPlistArray(plist: string, key: string): string[] {
    const regex = new RegExp(
      `<key>${key}</key>\\s*<array>([\\s\\S]*?)</array>`,
    );
    const match = plist.match(regex);
    if (!match) return [];

    const arrayContent = match[1];
    const stringRegex = /<string>([^<]*)<\/string>/g;
    const values: string[] = [];
    let stringMatch;

    while ((stringMatch = stringRegex.exec(arrayContent)) !== null) {
      values.push(stringMatch[1]);
    }

    return values;
  }

  /**
   * Extract a dict section from plist
   */
  private extractPlistDict(plist: string, key: string): string {
    const regex = new RegExp(`<key>${key}</key>\\s*<dict>([\\s\\S]*?)</dict>`);
    const match = plist.match(regex);
    return match ? match[1] : '';
  }
}
