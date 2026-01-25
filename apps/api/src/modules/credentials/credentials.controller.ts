import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CredentialsService } from './credentials.service';
import { IosCertificateValidator } from './validators/ios-certificate.validator';
import { AndroidKeystoreValidator } from './validators/android-keystore.validator';
import { AppsService } from '../apps/apps.service';
import { UploadIosCredentialDto, UploadAndroidCredentialDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface UserContext {
  userId: string;
  accountId: string;
  email: string;
  role: string;
}

@Controller('apps/:appId/credentials')
@UseGuards(AuthGuard('jwt'))
export class CredentialsController {
  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly appsService: AppsService,
    private readonly iosValidator: IosCertificateValidator,
    private readonly androidValidator: AndroidKeystoreValidator,
  ) {}

  /**
   * List credentials for an app
   * GET /v1/apps/:appId/credentials
   */
  @Get()
  async list(
    @Param('appId') appId: string,
    @CurrentUser() user: UserContext,
  ) {
    // Verify access
    await this.appsService.findById(appId, user.userId);

    return this.credentialsService.list(appId);
  }

  /**
   * Get credential by ID
   * GET /v1/apps/:appId/credentials/:credentialId
   */
  @Get(':credentialId')
  async findById(
    @Param('appId') appId: string,
    @Param('credentialId') credentialId: string,
    @CurrentUser() user: UserContext,
  ) {
    // Verify access
    await this.appsService.findById(appId, user.userId);

    return this.credentialsService.findById(appId, credentialId);
  }

  /**
   * Upload iOS credentials
   * POST /v1/apps/:appId/credentials/ios
   */
  @Post('ios')
  async uploadIos(
    @Param('appId') appId: string,
    @Body() dto: UploadIosCredentialDto,
    @CurrentUser() user: UserContext,
  ) {
    // Verify edit access
    await this.appsService.findById(appId, user.userId);

    // Decode base64
    let p12Buffer: Buffer;
    let provisioningBuffer: Buffer;

    try {
      p12Buffer = Buffer.from(dto.certificate_p12, 'base64');
    } catch {
      throw new BadRequestException('Invalid base64 for certificate_p12');
    }

    try {
      provisioningBuffer = Buffer.from(dto.provisioning_profile, 'base64');
    } catch {
      throw new BadRequestException('Invalid base64 for provisioning_profile');
    }

    // Validate P12
    const certInfo = this.iosValidator.validateP12(p12Buffer, dto.password);

    // Validate provisioning profile
    const provisioningInfo = this.iosValidator.validateProvisioning(provisioningBuffer);

    // Verify team IDs match
    if (certInfo.teamId !== provisioningInfo.teamId) {
      throw new BadRequestException(
        `Certificate team ID (${certInfo.teamId}) does not match provisioning profile team ID (${provisioningInfo.teamId})`,
      );
    }

    // Verify it's a distribution certificate
    if (!certInfo.isDistribution) {
      throw new BadRequestException(
        'Certificate must be a Distribution certificate for App Store builds',
      );
    }

    // Save credential
    return this.credentialsService.saveIosCredential(
      appId,
      {
        p12: p12Buffer,
        password: dto.password,
        provisioning: provisioningBuffer,
      },
      {
        teamId: certInfo.teamId,
        bundleId: provisioningInfo.bundleId,
        expiresAt: certInfo.expiresAt,
        commonName: certInfo.commonName,
        isDistribution: certInfo.isDistribution,
        isAppStore: provisioningInfo.isAppStore,
      },
    );
  }

  /**
   * Upload Android credentials
   * POST /v1/apps/:appId/credentials/android
   */
  @Post('android')
  async uploadAndroid(
    @Param('appId') appId: string,
    @Body() dto: UploadAndroidCredentialDto,
    @CurrentUser() user: UserContext,
  ) {
    // Verify edit access
    await this.appsService.findById(appId, user.userId);

    // Decode base64
    let keystoreBuffer: Buffer;

    try {
      keystoreBuffer = Buffer.from(dto.keystore, 'base64');
    } catch {
      throw new BadRequestException('Invalid base64 for keystore');
    }

    // Validate keystore
    // Use simple validation if keytool is not available
    let keystoreInfo: { keyAlias: string; validUntil: Date; fingerprintSha256?: string };

    try {
      const fullInfo = await this.androidValidator.validateKeystore(
        keystoreBuffer,
        dto.keystore_password,
        dto.key_alias,
        dto.key_password,
      );
      keystoreInfo = {
        keyAlias: fullInfo.alias,
        validUntil: fullInfo.validUntil,
        fingerprintSha256: fullInfo.fingerprintSha256,
      };
    } catch {
      // Fallback to simple validation
      const simpleResult = await this.androidValidator.validateKeystoreSimple(
        keystoreBuffer,
        dto.keystore_password,
        dto.key_alias,
      );

      keystoreInfo = {
        keyAlias: simpleResult.alias,
        validUntil: new Date(Date.now() + 25 * 365 * 24 * 60 * 60 * 1000), // Default: 25 years
      };
    }

    // Save credential
    return this.credentialsService.saveAndroidCredential(
      appId,
      {
        keystore: keystoreBuffer,
        keystorePassword: dto.keystore_password,
        keyAlias: dto.key_alias,
        keyPassword: dto.key_password,
      },
      keystoreInfo,
    );
  }

  /**
   * Delete credential
   * DELETE /v1/apps/:appId/credentials/:credentialId
   */
  @Delete(':credentialId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('appId') appId: string,
    @Param('credentialId') credentialId: string,
    @CurrentUser() user: UserContext,
  ) {
    // Verify edit access
    await this.appsService.findById(appId, user.userId);

    await this.credentialsService.delete(appId, credentialId);
  }
}
