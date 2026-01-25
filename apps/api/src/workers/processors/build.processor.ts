import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  CodemagicService,
  CodemagicBuildConfig,
  CodemagicCredentials,
} from '../../modules/builds/codemagic.service';
import { QUEUE_NAMES } from '@appfy/shared';

interface BuildJobData {
  buildJobId: string;
  appId: string;
  appVersionId: string;
  platform: 'ios' | 'android';
  versionName: string;
  versionCode: number;
}

@Processor(QUEUE_NAMES.BUILD)
export class BuildProcessor extends WorkerHost {
  private readonly logger = new Logger(BuildProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
    private readonly codemagic: CodemagicService,
  ) {
    super();
  }

  async process(job: Job<BuildJobData>): Promise<void> {
    const { buildJobId, appId, platform, versionName, versionCode } = job.data;

    this.logger.log(
      `Processing build ${buildJobId} for app ${appId} (${platform} v${versionName})`,
    );

    try {
      // Update status to running
      await this.updateStatus(buildJobId, 'running');

      // Get app with all details
      const app = await this.prisma.app.findUnique({
        where: { id: appId },
        include: {
          store: true,
          credentials: {
            where: { platform },
          },
        },
      });

      if (!app) {
        throw new Error(`App ${appId} not found`);
      }

      // Prepare build configuration
      const buildConfig: CodemagicBuildConfig = {
        appId: app.id,
        storeId: app.store_id,
        platform,
        versionName,
        versionCode,
        bundleId:
          platform === 'ios' ? app.bundle_id_ios! : app.bundle_id_android!,
        appName: app.name,
        apiBaseUrl: this.config.get('API_BASE_URL', 'https://api.appfy.com/v1'),
        primaryDomain: app.store.primary_domain,
        oneSignalAppId: app.onesignal_app_id || undefined,
        rcPublicKey: app.rc_public_key || undefined,
        iconUrl: app.icon_url || undefined,
        splashUrl: app.splash_url || undefined,
      };

      // Download and decrypt credentials
      const credential = app.credentials[0];
      if (!credential) {
        throw new Error(`No ${platform} credentials found`);
      }

      const encryptedCredentials = await this.storage.download(
        credential.secret_ref,
      );
      const credentialsBuffer =
        this.encryption.decryptPacked(encryptedCredentials);
      const rawCredentials = JSON.parse(credentialsBuffer.toString());

      // Map credentials to Codemagic format
      const codemagicCredentials: CodemagicCredentials =
        platform === 'ios'
          ? {
              certificate_p12: rawCredentials.certificate_p12,
              certificate_password: rawCredentials.password,
              provisioning_profile: rawCredentials.provisioning_profile,
            }
          : {
              keystore: rawCredentials.keystore,
              keystore_password: rawCredentials.keystore_password,
              key_alias: rawCredentials.key_alias,
              key_password: rawCredentials.key_password,
            };

      // Log build start (without sensitive data)
      this.logger.log(`Build config prepared for ${buildConfig.bundleId}`);

      // Trigger build
      const externalBuildId = await this.triggerBuild(
        buildJobId,
        buildConfig,
        codemagicCredentials,
      );

      // Update with external build ID
      await this.prisma.buildJob.update({
        where: { id: buildJobId },
        data: { external_build_id: externalBuildId },
      });

      this.logger.log(
        `Build ${buildJobId} triggered successfully: ${externalBuildId}`,
      );

      // Note: The build completion will be handled by a webhook from Codemagic
      // The webhook will call our API to update status and upload artifact
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Build ${buildJobId} failed: ${message}`);

      await this.updateStatus(buildJobId, 'failed', message);

      throw error;
    }
  }

  private async updateStatus(
    buildJobId: string,
    status: string,
    errorMessage?: string,
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    if (status === 'running') {
      updateData.started_at = new Date();
    } else if (['completed', 'failed'].includes(status)) {
      updateData.completed_at = new Date();
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    await this.prisma.buildJob.update({
      where: { id: buildJobId },
      data: updateData,
    });

    // Update AppVersion status
    const build = await this.prisma.buildJob.findUnique({
      where: { id: buildJobId },
    });

    if (build) {
      await this.prisma.appVersion.update({
        where: { id: build.app_version_id },
        data: {
          status: status === 'completed' ? 'built' : status,
        },
      });
    }
  }

  /**
   * Trigger build on Codemagic or return mock for development
   */
  private async triggerBuild(
    buildJobId: string,
    config: CodemagicBuildConfig,
    credentials: CodemagicCredentials,
  ): Promise<string> {
    // Check if Codemagic is configured
    if (this.codemagic.isConfigured()) {
      // Build webhook URL for Codemagic to call back
      const apiBaseUrl = this.config.get(
        'API_BASE_URL',
        'https://api.appfy.com',
      );
      const webhookUrl = `${apiBaseUrl}/webhooks/codemagic?buildJobId=${buildJobId}`;

      const result = await this.codemagic.startBuild(
        config,
        credentials,
        webhookUrl,
      );

      return result.buildId;
    }

    // Development mode - no Codemagic configured
    this.logger.warn(
      'Codemagic not configured. Using mock build ID for development.',
    );
    this.logger.warn(
      'Set CODEMAGIC_API_TOKEN and CODEMAGIC_APP_ID for real builds.',
    );

    // Simulate async completion in dev mode
    setTimeout(async () => {
      try {
        await this.simulateDevBuildCompletion(buildJobId, config);
      } catch (error) {
        this.logger.error('Dev build simulation failed:', error);
      }
    }, 5000);

    return `mock-build-${Date.now()}`;
  }

  /**
   * Simulate build completion in development mode
   */
  private async simulateDevBuildCompletion(
    buildJobId: string,
    config: CodemagicBuildConfig,
  ): Promise<void> {
    this.logger.log(`[DEV] Simulating build completion for ${buildJobId}`);

    // Update status to completed
    await this.prisma.buildJob.update({
      where: { id: buildJobId },
      data: {
        status: 'completed',
        completed_at: new Date(),
      },
    });

    // Update AppVersion
    const build = await this.prisma.buildJob.findUnique({
      where: { id: buildJobId },
    });

    if (build) {
      const artifactName =
        config.platform === 'ios' ? 'app-dev.ipa' : 'app-dev.apk';

      await this.prisma.appVersion.update({
        where: { id: build.app_version_id },
        data: {
          status: 'built',
          artifact_url: `mock://${config.appId}/${artifactName}`,
        },
      });
    }

    this.logger.log(`[DEV] Build ${buildJobId} marked as completed`);
  }
}
