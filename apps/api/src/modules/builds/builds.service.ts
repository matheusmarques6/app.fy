import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { AppsService } from '../apps/apps.service';
import { CredentialsService } from '../credentials/credentials.service';
import { CodemagicService } from './codemagic.service';
import { QUEUE_NAMES } from '@appfy/shared';
import { CreateBuildDto, BuildResponse, BuildJobData } from './dto';

export interface BuildListItem {
  id: string;
  app_version_id: string;
  platform: string;
  version_name: string;
  version_code: number;
  status: string;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface BuildDetail extends BuildListItem {
  artifact_url: string | null;
  log_url: string | null;
  external_build_id: string | null;
}

@Injectable()
export class BuildsService {
  private readonly logger = new Logger(BuildsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly appsService: AppsService,
    private readonly credentialsService: CredentialsService,
    private readonly codemagicService: CodemagicService,
    @InjectQueue(QUEUE_NAMES.BUILD)
    private readonly buildQueue: Queue,
  ) {}

  /**
   * Create a new build
   */
  async create(
    appId: string,
    userId: string,
    dto: CreateBuildDto,
  ): Promise<BuildResponse> {
    // Verify access and get app
    const app = await this.appsService.findById(appId, userId);

    // Check build readiness
    const readiness = await this.appsService.checkBuildReadiness(
      appId,
      dto.platform,
    );

    if (!readiness.ready) {
      throw new BadRequestException(
        `Cannot start build: ${readiness.missing.join(', ')}`,
      );
    }

    // Check for existing build in progress
    const existingBuild = await this.prisma.buildJob.findFirst({
      where: {
        app_version: {
          app_id: appId,
          platform: dto.platform,
        },
        status: { in: ['pending', 'running'] },
      },
    });

    if (existingBuild) {
      throw new ConflictException(
        `A ${dto.platform} build is already in progress`,
      );
    }

    // Calculate next version code
    const versionCode = await this.getNextVersionCode(appId, dto.platform);

    // Create AppVersion
    const appVersion = await this.prisma.appVersion.create({
      data: {
        app_id: appId,
        platform: dto.platform,
        version_name: dto.version_name,
        version_code: versionCode,
        status: 'pending',
      },
    });

    // Create BuildJob
    const buildJob = await this.prisma.buildJob.create({
      data: {
        app_version_id: appVersion.id,
        status: 'pending',
      },
    });

    // Queue the build job
    const jobData: BuildJobData = {
      buildJobId: buildJob.id,
      appId,
      appVersionId: appVersion.id,
      platform: dto.platform,
      versionName: dto.version_name,
      versionCode,
    };

    await this.buildQueue.add('process-build', jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 60000, // 1 minute
      },
    });

    this.logger.log(
      `Build queued: ${buildJob.id} for app ${appId} (${dto.platform} v${dto.version_name})`,
    );

    return {
      id: buildJob.id,
      app_version_id: appVersion.id,
      platform: dto.platform,
      version: {
        name: dto.version_name,
        code: versionCode,
      },
      status: 'queued',
      created_at: buildJob.created_at.toISOString(),
    };
  }

  /**
   * List builds for an app
   * Returns format expected by frontend: { id, version: {...}, job: {...} }
   */
  async list(appId: string, platform?: 'ios' | 'android') {
    const builds = await this.prisma.buildJob.findMany({
      where: {
        app_version: {
          app_id: appId,
          ...(platform && { platform }),
        },
      },
      include: {
        app_version: true,
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return builds.map((b) => ({
      id: b.id,
      version: {
        id: b.app_version.id,
        version_code: b.app_version.version_code,
        version_name: b.app_version.version_name,
        platform: b.app_version.platform as 'ios' | 'android',
        status: b.app_version.status,
        artifact_url: b.app_version.artifact_url,
      },
      job: {
        id: b.id,
        status: b.status as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
        error_message: b.error_message,
        started_at: b.started_at?.toISOString(),
        completed_at: b.completed_at?.toISOString(),
        created_at: b.created_at.toISOString(),
        artifact_url: b.app_version.artifact_url,
        log_url: b.log_url,
      },
    }));
  }

  /**
   * Get build details
   */
  async findById(appId: string, buildId: string): Promise<BuildDetail> {
    const build = await this.prisma.buildJob.findFirst({
      where: {
        id: buildId,
        app_version: { app_id: appId },
      },
      include: {
        app_version: true,
      },
    });

    if (!build) {
      throw new NotFoundException('Build not found');
    }

    return {
      id: build.id,
      app_version_id: build.app_version_id,
      platform: build.app_version.platform,
      version_name: build.app_version.version_name,
      version_code: build.app_version.version_code,
      status: build.status,
      error_message: build.error_message,
      artifact_url: build.app_version.artifact_url,
      log_url: build.log_url,
      external_build_id: build.external_build_id,
      started_at: build.started_at?.toISOString() || null,
      completed_at: build.completed_at?.toISOString() || null,
      created_at: build.created_at.toISOString(),
    };
  }

  /**
   * Get build logs
   */
  async getLogs(appId: string, buildId: string): Promise<string> {
    const build = await this.findById(appId, buildId);

    if (!build.log_url) {
      return 'No logs available yet.';
    }

    try {
      const logBuffer = await this.storage.download(build.log_url);
      return logBuffer.toString('utf-8');
    } catch {
      return 'Failed to retrieve logs.';
    }
  }

  /**
   * Get signed download URL for artifact
   */
  async getDownloadUrl(appId: string, buildId: string): Promise<string> {
    const build = await this.findById(appId, buildId);

    if (!build.artifact_url) {
      throw new NotFoundException('Build artifact not available');
    }

    if (build.status !== 'completed') {
      throw new BadRequestException('Build is not complete');
    }

    return this.storage.getSignedDownloadUrl(build.artifact_url, {
      expiresIn: 3600, // 1 hour
      responseContentDisposition: `attachment; filename="${build.platform === 'ios' ? 'app.ipa' : 'app.apk'}"`,
    });
  }

  /**
   * Cancel a pending/running build
   */
  async cancel(appId: string, buildId: string): Promise<void> {
    const build = await this.prisma.buildJob.findFirst({
      where: {
        id: buildId,
        app_version: { app_id: appId },
      },
    });

    if (!build) {
      throw new NotFoundException('Build not found');
    }

    if (!['pending', 'running'].includes(build.status)) {
      throw new BadRequestException('Build cannot be cancelled');
    }

    await this.prisma.buildJob.update({
      where: { id: buildId },
      data: {
        status: 'cancelled',
        error_message: 'Cancelled by user',
        completed_at: new Date(),
      },
    });

    await this.prisma.appVersion.update({
      where: { id: build.app_version_id },
      data: { status: 'cancelled' },
    });

    // Cancel external Codemagic build if it's running and has an external ID
    if (build.external_build_id && build.status === 'running') {
      try {
        await this.codemagicService.cancelBuild(build.external_build_id);
        this.logger.log(`Codemagic build ${build.external_build_id} cancelled`);
      } catch (error) {
        this.logger.error(`Failed to cancel Codemagic build ${build.external_build_id}:`, error);
        // Do not re-throw: local cancel succeeded; Codemagic failure is non-blocking
      }
    }

    this.logger.log(`Build cancelled: ${buildId}`);
  }

  /**
   * Update build status (called by processor)
   */
  async updateStatus(
    buildJobId: string,
    status: string,
    errorMessage?: string,
    externalBuildId?: string,
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

    if (externalBuildId) {
      updateData.external_build_id = externalBuildId;
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
   * Update artifact URL (called by processor)
   */
  async updateArtifact(buildJobId: string, artifactUrl: string): Promise<void> {
    const build = await this.prisma.buildJob.findUnique({
      where: { id: buildJobId },
    });

    if (build) {
      await this.prisma.appVersion.update({
        where: { id: build.app_version_id },
        data: { artifact_url: artifactUrl },
      });
    }
  }

  /**
   * Update log URL (called by processor)
   */
  async updateLogUrl(buildJobId: string, logUrl: string): Promise<void> {
    await this.prisma.buildJob.update({
      where: { id: buildJobId },
      data: { log_url: logUrl },
    });
  }

  /**
   * Get next version code for platform
   */
  private async getNextVersionCode(
    appId: string,
    platform: string,
  ): Promise<number> {
    const latest = await this.prisma.appVersion.findFirst({
      where: {
        app_id: appId,
        platform,
      },
      orderBy: { version_code: 'desc' },
    });

    return (latest?.version_code || 0) + 1;
  }
}
