// @ts-nocheck
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { createHash, createSign, generateKeyPairSync } from 'crypto';
import {
  AppConfig,
  RemoteConfigEnvelope,
  DEFAULT_THEME,
  DEFAULT_MODULES,
  DEFAULT_PUSH_CONFIG,
  ThemeConfig,
  AllowlistConfig,
  ModulesConfig,
  PushConfig,
  FeatureFlagsConfig,
} from './types/app-config.types';
import { REMOTE_CONFIG_TTL_SECONDS } from '@appfy/shared';

interface UpdateAppConfigDto {
  modules?: Partial<ModulesConfig>;
  theme?: Partial<ThemeConfig>;
  allowlist?: Partial<AllowlistConfig>;
  push?: Partial<PushConfig>;
  features?: FeatureFlagsConfig;
}

@Injectable()
export class RemoteConfigService {
  private readonly logger = new Logger(RemoteConfigService.name);
  private readonly CACHE_PREFIX = 'rc:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get the current config for an app (signed envelope)
   */
  async getConfig(appId: string): Promise<{ envelope: RemoteConfigEnvelope; etag: string }> {
    // Check cache first
    const cacheKey = `${this.CACHE_PREFIX}${appId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      const envelope = JSON.parse(cached as string) as RemoteConfigEnvelope;
      const etag = this.generateETag(envelope);
      return { envelope, etag };
    }

    // Get app with latest config version
    const app = await this.prisma.app.findUnique({
      where: { id: appId },
      include: {
        store: true,
        config_versions: {
          where: { is_active: true },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    // Build config
    const configVersion = app.config_versions[0];
    const config = this.buildConfig(app, configVersion);

    // Sign the config
    const envelope = await this.signConfig(app.id, config);

    // Cache it
    await this.redis.set(cacheKey, JSON.stringify(envelope), REMOTE_CONFIG_TTL_SECONDS);

    const etag = this.generateETag(envelope);
    return { envelope, etag };
  }

  /**
   * Get current draft config for editing
   */
  async getDraftConfig(storeId: string, appId: string): Promise<AppConfig> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, store_id: storeId },
      include: {
        config_versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    const configVersion = app.config_versions[0];
    return this.buildConfig(app, configVersion);
  }

  /**
   * Update draft config
   */
  async updateDraftConfig(
    storeId: string,
    appId: string,
    updates: UpdateAppConfigDto,
  ): Promise<AppConfig> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, store_id: storeId },
      include: {
        config_versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    const currentVersion = app.config_versions[0];
    const currentConfig = currentVersion?.config as any || {};

    // Merge updates
    const newConfig = {
      modules: { ...currentConfig.modules, ...updates.modules },
      theme: this.mergeTheme(currentConfig.theme, updates.theme),
      allowlist: { ...currentConfig.allowlist, ...updates.allowlist },
      push: { ...currentConfig.push, ...updates.push },
      features: { ...currentConfig.features, ...updates.features },
    };

    if (currentVersion) {
      // Update existing draft (if not published)
      if (!currentVersion.is_active) {
        await this.prisma.appConfigVersion.update({
          where: { id: currentVersion.id },
          data: {
            config: newConfig as any,
            updated_at: new Date(),
          },
        });
      } else {
        // Create new draft version
        await this.prisma.appConfigVersion.create({
          data: {
            app_id: appId,
            store_id: storeId,
            version: currentVersion.version + 1,
            config: newConfig as any,
            is_active: false,
          },
        });
      }
    } else {
      // Create first version
      await this.prisma.appConfigVersion.create({
        data: {
          app_id: appId,
          store_id: storeId,
          version: 1,
          config: newConfig as any,
          is_active: false,
        },
      });
    }

    return this.getDraftConfig(storeId, appId);
  }

  /**
   * Publish the current draft config
   */
  async publishConfig(storeId: string, appId: string): Promise<AppConfig> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, store_id: storeId },
      include: {
        config_versions: {
          orderBy: { version: 'desc' },
          take: 2, // Get latest and previous
        },
      },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    const latestVersion = app.config_versions[0];
    const previousVersion = app.config_versions[1];

    if (!latestVersion) {
      throw new NotFoundException('No config version to publish');
    }

    if (latestVersion.is_active) {
      throw new Error('Latest version is already published');
    }

    // Deactivate previous version
    if (previousVersion?.is_active) {
      await this.prisma.appConfigVersion.update({
        where: { id: previousVersion.id },
        data: { is_active: false },
      });
    }

    // Activate new version
    await this.prisma.appConfigVersion.update({
      where: { id: latestVersion.id },
      data: {
        is_active: true,
        published_at: new Date(),
      },
    });

    // Invalidate cache
    const cacheKey = `${this.CACHE_PREFIX}${appId}`;
    await this.redis.del(cacheKey);

    this.logger.log(`Published config v${latestVersion.version} for app ${appId}`);

    return this.getDraftConfig(storeId, appId);
  }

  /**
   * Get config version history
   */
  async getVersionHistory(storeId: string, appId: string) {
    const versions = await this.prisma.appConfigVersion.findMany({
      where: { app_id: appId, store_id: storeId },
      orderBy: { version: 'desc' },
      take: 20,
      select: {
        id: true,
        version: true,
        is_active: true,
        created_at: true,
        published_at: true,
      },
    });

    return versions;
  }

  /**
   * Rollback to a previous version
   */
  async rollbackToVersion(storeId: string, appId: string, versionId: string): Promise<AppConfig> {
    const targetVersion = await this.prisma.appConfigVersion.findFirst({
      where: { id: versionId, app_id: appId, store_id: storeId },
    });

    if (!targetVersion) {
      throw new NotFoundException('Version not found');
    }

    // Deactivate current active version
    await this.prisma.appConfigVersion.updateMany({
      where: { app_id: appId, is_active: true },
      data: { is_active: false },
    });

    // Create new version with old config
    const latestVersion = await this.prisma.appConfigVersion.findFirst({
      where: { app_id: appId },
      orderBy: { version: 'desc' },
    });

    await this.prisma.appConfigVersion.create({
      data: {
        app_id: appId,
        store_id: storeId,
        version: (latestVersion?.version || 0) + 1,
        config: targetVersion.config as any,
        is_active: true,
        published_at: new Date(),
      },
    });

    // Invalidate cache
    const cacheKey = `${this.CACHE_PREFIX}${appId}`;
    await this.redis.del(cacheKey);

    return this.getDraftConfig(storeId, appId);
  }

  // ==================== Private Methods ====================

  private buildConfig(app: any, configVersion: any): AppConfig {
    const savedConfig = configVersion?.config as any || {};

    return {
      version: configVersion?.version || 1,
      publishedAt: configVersion?.published_at?.toISOString() || new Date().toISOString(),
      modules: { ...DEFAULT_MODULES, ...savedConfig.modules },
      theme: this.mergeTheme(DEFAULT_THEME, savedConfig.theme),
      allowlist: {
        primary: savedConfig.allowlist?.primary || [app.store?.primary_domain].filter(Boolean),
        payment: savedConfig.allowlist?.payment || [],
        asset: savedConfig.allowlist?.asset || [],
        deeplinks: savedConfig.allowlist?.deeplinks || [],
      },
      push: { ...DEFAULT_PUSH_CONFIG, ...savedConfig.push },
      features: savedConfig.features || {},
    };
  }

  private mergeTheme(base: ThemeConfig | undefined, updates: Partial<ThemeConfig> | undefined): ThemeConfig {
    if (!base) return DEFAULT_THEME;
    if (!updates) return base;

    return {
      colors: {
        ...base.colors,
        ...updates.colors,
        text: {
          ...base.colors.text,
          ...updates.colors?.text,
        },
      },
      fonts: { ...base.fonts, ...updates.fonts },
      borderRadius: { ...base.borderRadius, ...updates.borderRadius },
      spacing: { ...base.spacing, ...updates.spacing },
    };
  }

  private async signConfig(appId: string, config: AppConfig): Promise<RemoteConfigEnvelope> {
    // For now, use HMAC-SHA256 with a secret
    // In production, use Ed25519 with proper key management
    const secret = process.env.REMOTE_CONFIG_SIGNING_KEY || 'dev-signing-key';
    const keyId = 'v1';

    // Canonical JSON (sorted keys)
    const canonicalJson = JSON.stringify(config, Object.keys(config).sort());

    const signature = createHash('sha256')
      .update(secret)
      .update(canonicalJson)
      .digest('base64');

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + REMOTE_CONFIG_TTL_SECONDS);

    return {
      config,
      signature,
      algorithm: 'HMAC-SHA256',
      keyId,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private generateETag(envelope: RemoteConfigEnvelope): string {
    const hash = createHash('md5')
      .update(JSON.stringify(envelope.config))
      .digest('hex');
    return `"${hash}"`;
  }
}
