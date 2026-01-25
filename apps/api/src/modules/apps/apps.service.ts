import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { UpdateAppDto } from './dto';

export interface AppResponse {
  id: string;
  store_id: string;
  name: string;
  bundle_id_ios: string | null;
  bundle_id_android: string | null;
  status: string;
  onesignal_configured: boolean;
  onesignal_app_id: string | null;
  rc_public_key: string | null;
  icon_url: string | null;
  splash_url: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class AppsService {
  private readonly logger = new Logger(AppsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Create an app for a store
   */
  async create(storeId: string, userId: string, name: string): Promise<AppResponse> {
    // Verify user has edit access to store
    await this.verifyStoreEditAccess(storeId, userId);

    // Check if app already exists
    const existing = await this.prisma.app.findUnique({
      where: { store_id: storeId },
    });

    if (existing) {
      throw new ConflictException('App already exists for this store');
    }

    // Get store info for default name
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const app = await this.prisma.app.create({
      data: {
        store_id: storeId,
        name: name || store.name,
        status: 'draft',
        config: {
          theme: {
            primary_color: '#000000',
            secondary_color: '#ffffff',
          },
          tabs: ['home', 'search', 'favorites', 'account', 'notifications'],
        },
      },
    });

    this.logger.log(`App created for store: ${storeId}`);

    return this.mapToResponse(app);
  }

  /**
   * Get apps for a store (one app per store in MVP, returns array for future compatibility)
   */
  async findByStoreId(storeId: string, userId: string): Promise<AppResponse[]> {
    // Verify user has access to store
    await this.verifyStoreAccess(storeId, userId);

    const app = await this.prisma.app.findUnique({
      where: { store_id: storeId },
    });

    if (!app) {
      return []; // Return empty array if no app exists
    }

    return [this.mapToResponse(app)];
  }

  /**
   * Get app by ID
   */
  async findById(appId: string, userId: string): Promise<AppResponse> {
    const app = await this.prisma.app.findUnique({
      where: { id: appId },
      include: { store: true },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    // Verify user has access to the store
    await this.verifyStoreAccess(app.store_id, userId);

    return this.mapToResponse(app);
  }

  /**
   * Update app settings
   */
  async update(
    appId: string,
    userId: string,
    dto: UpdateAppDto,
  ): Promise<AppResponse> {
    const app = await this.prisma.app.findUnique({
      where: { id: appId },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    // Verify user has edit permission
    await this.verifyStoreEditAccess(app.store_id, userId);

    // Check if bundle IDs can be changed (not after first build)
    if (dto.bundle_id_ios || dto.bundle_id_android) {
      const hasBuilds = await this.prisma.appVersion.count({
        where: {
          app_id: appId,
          status: { in: ['built', 'published'] },
        },
      });

      if (hasBuilds > 0) {
        // Check if trying to change existing bundle IDs
        if (dto.bundle_id_ios && app.bundle_id_ios && dto.bundle_id_ios !== app.bundle_id_ios) {
          throw new BadRequestException(
            'Cannot change iOS bundle ID after first build',
          );
        }
        if (dto.bundle_id_android && app.bundle_id_android && dto.bundle_id_android !== app.bundle_id_android) {
          throw new BadRequestException(
            'Cannot change Android package name after first build',
          );
        }
      }
    }

    const updated = await this.prisma.app.update({
      where: { id: appId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.bundle_id_ios && { bundle_id_ios: dto.bundle_id_ios }),
        ...(dto.bundle_id_android && { bundle_id_android: dto.bundle_id_android }),
      },
    });

    this.logger.log(`App updated: ${appId}`);

    return this.mapToResponse(updated);
  }

  /**
   * Setup OneSignal for the app (manual entry)
   */
  async setupOneSignalManual(
    appId: string,
    userId: string,
    onesignalAppId: string,
    apiKey: string,
  ): Promise<void> {
    const app = await this.prisma.app.findUnique({
      where: { id: appId },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    await this.verifyStoreEditAccess(app.store_id, userId);

    // Encrypt the API key
    const encryptedApiKey = this.encryption.encryptString(apiKey);

    await this.prisma.app.update({
      where: { id: appId },
      data: {
        onesignal_app_id: onesignalAppId,
        onesignal_api_key: encryptedApiKey,
      },
    });

    this.logger.log(`OneSignal configured for app: ${appId}`);
  }

  /**
   * Disconnect OneSignal
   */
  async disconnectOneSignal(appId: string, userId: string): Promise<void> {
    const app = await this.prisma.app.findUnique({
      where: { id: appId },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    await this.verifyStoreEditAccess(app.store_id, userId);

    await this.prisma.app.update({
      where: { id: appId },
      data: {
        onesignal_app_id: null,
        onesignal_api_key: null,
      },
    });

    this.logger.log(`OneSignal disconnected from app: ${appId}`);
  }

  /**
   * Update icon URL after upload
   */
  async updateIconUrl(appId: string, iconUrl: string): Promise<void> {
    await this.prisma.app.update({
      where: { id: appId },
      data: { icon_url: iconUrl },
    });
  }

  /**
   * Update splash URL after upload
   */
  async updateSplashUrl(appId: string, splashUrl: string): Promise<void> {
    await this.prisma.app.update({
      where: { id: appId },
      data: { splash_url: splashUrl },
    });
  }

  /**
   * Update Remote Config keypair
   */
  async updateKeypair(
    appId: string,
    publicKey: string,
    privateKeyRef: string,
  ): Promise<void> {
    await this.prisma.app.update({
      where: { id: appId },
      data: {
        rc_public_key: publicKey,
        rc_private_key_ref: privateKeyRef,
      },
    });
  }

  /**
   * Get app versions
   */
  async getVersions(appId: string, userId: string) {
    const app = await this.prisma.app.findUnique({
      where: { id: appId },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    await this.verifyStoreAccess(app.store_id, userId);

    const versions = await this.prisma.appVersion.findMany({
      where: { app_id: appId },
      orderBy: { created_at: 'desc' },
      include: {
        build_jobs: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });

    return versions.map((v) => ({
      id: v.id,
      version_name: v.version_name,
      version_code: v.version_code,
      platform: v.platform,
      status: v.status,
      artifact_url: v.artifact_url,
      build_job: v.build_jobs[0]
        ? {
            id: v.build_jobs[0].id,
            status: v.build_jobs[0].status,
            error_message: v.build_jobs[0].error_message,
            started_at: v.build_jobs[0].started_at?.toISOString(),
            completed_at: v.build_jobs[0].completed_at?.toISOString(),
          }
        : null,
      created_at: v.created_at.toISOString(),
    }));
  }

  /**
   * Check build readiness (for all platforms)
   */
  async checkBuildReadiness(appId: string, platform?: 'ios' | 'android') {
    const app = await this.prisma.app.findUnique({
      where: { id: appId },
      include: {
        credentials: true,
      },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    const hasIcon = !!app.icon_url;
    const hasSplash = !!app.splash_url;
    const hasIosCredentials = app.credentials.some(c => c.platform === 'ios');
    const hasAndroidCredentials = app.credentials.some(c => c.platform === 'android');
    const hasOneSignal = !!app.onesignal_app_id;
    const hasKeypair = !!app.rc_public_key;

    const missing: string[] = [];

    if (!hasIcon) missing.push('App icon');
    if (!hasKeypair) missing.push('Remote Config keypair');

    // Platform-specific checks
    if (!platform || platform === 'ios') {
      if (!app.bundle_id_ios) missing.push('iOS Bundle ID');
      if (!hasIosCredentials) missing.push('iOS credentials');
    }
    if (!platform || platform === 'android') {
      if (!app.bundle_id_android) missing.push('Android Package Name');
      if (!hasAndroidCredentials) missing.push('Android credentials');
    }

    return {
      ready: missing.length === 0,
      checks: {
        hasIcon,
        hasSplash,
        hasIosCredentials,
        hasAndroidCredentials,
        hasOneSignal,
        hasKeypair,
      },
      missing,
    };
  }

  /**
   * Verify user has access to store
   */
  private async verifyStoreAccess(storeId: string, userId: string): Promise<void> {
    const membership = await this.prisma.storeMembership.findFirst({
      where: {
        store_id: storeId,
        user_id: userId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('No access to this store');
    }
  }

  /**
   * Verify user has edit access to store
   */
  private async verifyStoreEditAccess(storeId: string, userId: string): Promise<void> {
    const membership = await this.prisma.storeMembership.findFirst({
      where: {
        store_id: storeId,
        user_id: userId,
        role: { in: ['owner', 'admin', 'editor'] },
      },
    });

    if (!membership) {
      throw new ForbiddenException('No permission to edit this store');
    }
  }

  private mapToResponse(app: {
    id: string;
    store_id: string;
    name: string;
    bundle_id_ios: string | null;
    bundle_id_android: string | null;
    status: string;
    onesignal_app_id: string | null;
    onesignal_api_key: string | null;
    rc_public_key: string | null;
    icon_url: string | null;
    splash_url: string | null;
    config: unknown;
    created_at: Date;
    updated_at: Date;
  }): AppResponse {
    return {
      id: app.id,
      store_id: app.store_id,
      name: app.name,
      bundle_id_ios: app.bundle_id_ios,
      bundle_id_android: app.bundle_id_android,
      status: app.status,
      onesignal_configured: !!app.onesignal_app_id,
      onesignal_app_id: app.onesignal_app_id,
      rc_public_key: app.rc_public_key,
      icon_url: app.icon_url,
      splash_url: app.splash_url,
      config: app.config as Record<string, unknown>,
      created_at: app.created_at.toISOString(),
      updated_at: app.updated_at.toISOString(),
    };
  }
}
