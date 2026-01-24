// @ts-nocheck
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { createHash } from 'crypto';
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
   * Get the current published config for an app (signed envelope)
   * This is called by mobile apps to fetch their config
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

    // Get app with store info
    const app = await this.prisma.app.findUnique({
      where: { id: appId },
      include: { store: true },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    // Get latest published config from RemoteConfig
    const publishedConfig = await this.prisma.remoteConfig.findFirst({
      where: { store_id: app.store_id },
      orderBy: { config_version: 'desc' },
    });

    // Build config from published version or use defaults
    const config = this.buildConfig(app, publishedConfig);

    // Create envelope
    const envelope: RemoteConfigEnvelope = {
      config,
      signature: publishedConfig?.signature || '',
      algorithm: 'HMAC-SHA256',
      keyId: publishedConfig?.key_id || 'v1',
      expiresAt: publishedConfig?.expires_at?.toISOString() || new Date(Date.now() + REMOTE_CONFIG_TTL_SECONDS * 1000).toISOString(),
    };

    // Cache it
    await this.redis.set(cacheKey, JSON.stringify(envelope), REMOTE_CONFIG_TTL_SECONDS);

    const etag = this.generateETag(envelope);
    return { envelope, etag };
  }

  /**
   * Get current draft config for editing (from App.config)
   * This is used by the Console to edit config before publishing
   */
  async getDraftConfig(storeId: string, appId: string): Promise<AppConfig> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, store_id: storeId },
      include: { store: true },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    // Get latest published version number
    const latestPublished = await this.prisma.remoteConfig.findFirst({
      where: { store_id: storeId },
      orderBy: { config_version: 'desc' },
      select: { config_version: true },
    });

    return this.buildConfig(app, null, latestPublished?.config_version || 0);
  }

  /**
   * Update draft config (stored in App.config)
   */
  async updateDraftConfig(
    storeId: string,
    appId: string,
    updates: UpdateAppConfigDto,
  ): Promise<AppConfig> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, store_id: storeId },
      include: { store: true },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    const currentConfig = (app.config as any) || {};

    // Merge updates
    const newConfig = {
      modules: { ...currentConfig.modules, ...updates.modules },
      theme: this.mergeTheme(currentConfig.theme, updates.theme),
      allowlist: { ...currentConfig.allowlist, ...updates.allowlist },
      push: { ...currentConfig.push, ...updates.push },
      features: { ...currentConfig.features, ...updates.features },
    };

    // Update App.config
    await this.prisma.app.update({
      where: { id: appId },
      data: {
        config: newConfig as any,
        updated_at: new Date(),
      },
    });

    return this.getDraftConfig(storeId, appId);
  }

  /**
   * Publish the current draft config
   * Creates a new RemoteConfig record with signed payload
   */
  async publishConfig(storeId: string, appId: string): Promise<AppConfig> {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, store_id: storeId },
      include: { store: true },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    // Get current version number
    const latestVersion = await this.prisma.remoteConfig.findFirst({
      where: { store_id: storeId },
      orderBy: { config_version: 'desc' },
      select: { config_version: true },
    });

    const newVersion = (latestVersion?.config_version || 0) + 1;

    // Build the full config
    const config = this.buildConfig(app, null, newVersion);

    // Sign the config
    const { signature, keyId } = this.signPayload(config);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + REMOTE_CONFIG_TTL_SECONDS * 1000);

    // Create new RemoteConfig record
    await this.prisma.remoteConfig.create({
      data: {
        store_id: storeId,
        config_version: newVersion,
        payload: config as any,
        signature,
        key_id: keyId,
        issued_at: now,
        expires_at: expiresAt,
      },
    });

    // Invalidate cache
    const cacheKey = `${this.CACHE_PREFIX}${appId}`;
    await this.redis.del(cacheKey);

    this.logger.log(`Published config v${newVersion} for store ${storeId}`);

    return this.getDraftConfig(storeId, appId);
  }

  /**
   * Get config version history
   */
  async getVersionHistory(storeId: string, appId: string) {
    // Verify app belongs to store
    const app = await this.prisma.app.findFirst({
      where: { id: appId, store_id: storeId },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    const versions = await this.prisma.remoteConfig.findMany({
      where: { store_id: storeId },
      orderBy: { config_version: 'desc' },
      take: 20,
      select: {
        id: true,
        config_version: true,
        issued_at: true,
        expires_at: true,
        created_at: true,
      },
    });

    return versions.map((v) => ({
      id: v.id,
      version: v.config_version,
      publishedAt: v.issued_at,
      expiresAt: v.expires_at,
      createdAt: v.created_at,
    }));
  }

  /**
   * Rollback to a previous version
   */
  async rollbackToVersion(storeId: string, appId: string, versionId: string): Promise<AppConfig> {
    const targetVersion = await this.prisma.remoteConfig.findFirst({
      where: { id: versionId, store_id: storeId },
    });

    if (!targetVersion) {
      throw new NotFoundException('Version not found');
    }

    // Get current version number
    const latestVersion = await this.prisma.remoteConfig.findFirst({
      where: { store_id: storeId },
      orderBy: { config_version: 'desc' },
      select: { config_version: true },
    });

    const newVersion = (latestVersion?.config_version || 0) + 1;

    // Re-sign the old payload with new timestamp
    const payload = targetVersion.payload as any;
    payload.version = newVersion;
    payload.publishedAt = new Date().toISOString();

    const { signature, keyId } = this.signPayload(payload);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + REMOTE_CONFIG_TTL_SECONDS * 1000);

    // Create new version with old config
    await this.prisma.remoteConfig.create({
      data: {
        store_id: storeId,
        config_version: newVersion,
        payload: payload as any,
        signature,
        key_id: keyId,
        issued_at: now,
        expires_at: expiresAt,
      },
    });

    // Invalidate cache
    const cacheKey = `${this.CACHE_PREFIX}${appId}`;
    await this.redis.del(cacheKey);

    this.logger.log(`Rolled back to version ${targetVersion.config_version} as v${newVersion} for store ${storeId}`);

    return this.getDraftConfig(storeId, appId);
  }

  // ==================== Private Methods ====================

  private buildConfig(app: any, publishedConfig: any, version: number = 1): AppConfig {
    // Use published config payload if available, otherwise use App.config draft
    const savedConfig = publishedConfig?.payload || (app.config as any) || {};

    return {
      version: publishedConfig?.config_version || version,
      publishedAt: publishedConfig?.issued_at?.toISOString() || new Date().toISOString(),
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

  private signPayload(config: AppConfig): { signature: string; keyId: string } {
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

    return { signature, keyId };
  }

  private generateETag(envelope: RemoteConfigEnvelope): string {
    const hash = createHash('md5')
      .update(JSON.stringify(envelope.config))
      .digest('hex');
    return `"${hash}"`;
  }
}
