import {
  Controller,
  Post,
  Body,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { CodemagicService } from './codemagic.service';

interface CodemagicWebhookPayload {
  buildId: string;
  buildStatus: 'queued' | 'preparing' | 'building' | 'publishing' | 'finished' | 'failed' | 'canceled';
  startedAt?: string;
  finishedAt?: string;
  branch?: string;
  commit?: string;
  artefacts?: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  error?: {
    message: string;
  };
}

@Controller('webhooks/codemagic')
export class CodemagicWebhookController {
  private readonly logger = new Logger(CodemagicWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly codemagic: CodemagicService,
  ) {}

  /**
   * Handle Codemagic webhook callback
   * POST /webhooks/codemagic?buildJobId=xxx
   *
   * Called by Codemagic when a build completes (success or failure)
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Query('buildJobId') buildJobId: string,
    @Headers('x-codemagic-signature') signature: string | undefined,
    @Body() payload: CodemagicWebhookPayload,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: boolean }> {
    this.logger.log(
      `Received Codemagic webhook for buildJobId=${buildJobId}, status=${payload.buildStatus}`,
    );

    // Validate buildJobId
    if (!buildJobId) {
      throw new BadRequestException('buildJobId is required');
    }

    // Validate signature if configured
    if (signature && req.rawBody) {
      const rawBody = req.rawBody.toString('utf8');
      if (!this.codemagic.verifyWebhookSignature(rawBody, signature)) {
        this.logger.warn(`Invalid webhook signature for build ${buildJobId}`);
        throw new BadRequestException('Invalid signature');
      }
    }

    // Find the build job
    const buildJob = await this.prisma.buildJob.findUnique({
      where: { id: buildJobId },
      include: { app_version: true },
    });

    if (!buildJob) {
      this.logger.warn(`Build job not found: ${buildJobId}`);
      // Return 200 to prevent retries
      return { received: true };
    }

    // Check if already completed (idempotency)
    if (['completed', 'failed'].includes(buildJob.status)) {
      this.logger.log(`Build ${buildJobId} already ${buildJob.status}, ignoring`);
      return { received: true };
    }

    // Process based on status
    try {
      switch (payload.buildStatus) {
        case 'finished':
          await this.handleBuildSuccess(buildJobId, buildJob.app_version_id, payload);
          break;

        case 'failed':
        case 'canceled':
          await this.handleBuildFailure(
            buildJobId,
            buildJob.app_version_id,
            payload.buildStatus,
            payload.error?.message,
          );
          break;

        case 'building':
        case 'preparing':
        case 'publishing':
          // Update status but don't complete
          await this.prisma.buildJob.update({
            where: { id: buildJobId },
            data: {
              status: 'running',
              started_at: payload.startedAt ? new Date(payload.startedAt) : new Date(),
            },
          });
          break;

        default:
          this.logger.log(`Ignoring status ${payload.buildStatus} for build ${buildJobId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process webhook for build ${buildJobId}:`, error);
      // Still return 200 to prevent excessive retries, but log the error
    }

    return { received: true };
  }

  /**
   * Handle successful build completion
   */
  private async handleBuildSuccess(
    buildJobId: string,
    appVersionId: string,
    payload: CodemagicWebhookPayload,
  ): Promise<void> {
    this.logger.log(`Build ${buildJobId} completed successfully`);

    // Find the artifact (IPA or APK)
    const artifact = payload.artefacts?.find(
      (a) => a.type === 'ipa' || a.type === 'apk' || a.name.endsWith('.ipa') || a.name.endsWith('.apk'),
    );

    let artifactUrl: string | undefined;

    if (artifact) {
      // Download artifact from Codemagic and upload to our storage
      try {
        this.logger.log(`Downloading artifact from Codemagic: ${artifact.name}`);
        const artifactBuffer = await this.codemagic.downloadArtifact(artifact.url);

        // Determine storage path
        const extension = artifact.type === 'ipa' ? 'ipa' : 'apk';
        const storagePath = `builds/${buildJobId}/app.${extension}`;

        // Upload to our storage (R2/S3)
        await this.storage.upload(storagePath, artifactBuffer, {
          contentType: extension === 'ipa' ? 'application/octet-stream' : 'application/vnd.android.package-archive',
        });

        artifactUrl = storagePath;
        this.logger.log(`Artifact uploaded to ${storagePath}`);
      } catch (error) {
        this.logger.error(`Failed to download/upload artifact:`, error);
        // Continue without artifact - build is still successful
      }
    }

    // Update build job status
    await this.prisma.buildJob.update({
      where: { id: buildJobId },
      data: {
        status: 'completed',
        completed_at: payload.finishedAt ? new Date(payload.finishedAt) : new Date(),
      },
    });

    // Update app version
    await this.prisma.appVersion.update({
      where: { id: appVersionId },
      data: {
        status: 'built',
        artifact_url: artifactUrl,
      },
    });

    this.logger.log(`Build ${buildJobId} marked as completed`);
  }

  /**
   * Handle build failure
   */
  private async handleBuildFailure(
    buildJobId: string,
    appVersionId: string,
    status: string,
    errorMessage?: string,
  ): Promise<void> {
    this.logger.warn(`Build ${buildJobId} failed: ${status} - ${errorMessage || 'Unknown error'}`);

    await this.prisma.buildJob.update({
      where: { id: buildJobId },
      data: {
        status: 'failed',
        completed_at: new Date(),
        error_message: errorMessage || `Build ${status}`,
      },
    });

    await this.prisma.appVersion.update({
      where: { id: appVersionId },
      data: { status: 'failed' },
    });
  }
}
