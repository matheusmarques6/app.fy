import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { ImageProcessorService } from './image-processor.service';

export interface AssetInfo {
  type: 'icon' | 'splash';
  url: string | null;
  uploaded: boolean;
  updated_at?: string;
}

export interface AssetsResponse {
  icon: AssetInfo;
  splash: AssetInfo;
}

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  /**
   * Get assets info for an app
   */
  async getAssets(appId: string): Promise<AssetsResponse> {
    const app = await this.prisma.app.findUnique({
      where: { id: appId },
      select: {
        icon_url: true,
        splash_url: true,
        updated_at: true,
      },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    return {
      icon: {
        type: 'icon',
        url: app.icon_url,
        uploaded: !!app.icon_url,
        updated_at: app.updated_at.toISOString(),
      },
      splash: {
        type: 'splash',
        url: app.splash_url,
        uploaded: !!app.splash_url,
        updated_at: app.updated_at.toISOString(),
      },
    };
  }

  /**
   * Upload and process app icon
   */
  async uploadIcon(appId: string, iconBuffer: Buffer): Promise<AssetInfo> {
    // Validate and process icon
    const { android, ios, iosContentsJson } =
      await this.imageProcessor.processAppIcon(iconBuffer);

    // Upload original icon
    const iconKey = `assets/${appId}/icon.png`;
    await this.storage.upload(iconKey, iconBuffer, {
      contentType: 'image/png',
      cacheControl: 'max-age=31536000', // 1 year
    });

    // Upload Android icons
    for (const [path, buffer] of android) {
      await this.storage.upload(
        `assets/${appId}/icon_android/${path}`,
        buffer,
        {
          contentType: 'image/png',
          cacheControl: 'max-age=31536000',
        },
      );
    }

    // Upload iOS icons
    for (const [path, buffer] of ios) {
      await this.storage.upload(
        `assets/${appId}/icon_ios/AppIcon.appiconset/${path}`,
        buffer,
        {
          contentType: 'image/png',
          cacheControl: 'max-age=31536000',
        },
      );
    }

    // Upload iOS Contents.json
    await this.storage.upload(
      `assets/${appId}/icon_ios/AppIcon.appiconset/Contents.json`,
      Buffer.from(iosContentsJson),
      {
        contentType: 'application/json',
        cacheControl: 'max-age=31536000',
      },
    );

    // Update app with icon URL
    await this.prisma.app.update({
      where: { id: appId },
      data: { icon_url: iconKey },
    });

    this.logger.log(`Icon uploaded for app: ${appId}`);

    return {
      type: 'icon',
      url: iconKey,
      uploaded: true,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Upload and process splash screen
   */
  async uploadSplash(appId: string, splashBuffer: Buffer): Promise<AssetInfo> {
    // Validate splash
    await this.imageProcessor.validateSplash(splashBuffer);

    // Process splash into multiple sizes
    const splashSizes = await this.imageProcessor.processSplash(splashBuffer);

    // Upload original splash
    const splashKey = `assets/${appId}/splash.png`;
    await this.storage.upload(splashKey, splashBuffer, {
      contentType: 'image/png',
      cacheControl: 'max-age=31536000',
    });

    // Upload processed sizes
    for (const [filename, buffer] of splashSizes) {
      await this.storage.upload(
        `assets/${appId}/splash/${filename}`,
        buffer,
        {
          contentType: 'image/png',
          cacheControl: 'max-age=31536000',
        },
      );
    }

    // Update app with splash URL
    await this.prisma.app.update({
      where: { id: appId },
      data: { splash_url: splashKey },
    });

    this.logger.log(`Splash uploaded for app: ${appId}`);

    return {
      type: 'splash',
      url: splashKey,
      uploaded: true,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Delete icon and all processed versions
   */
  async deleteIcon(appId: string): Promise<void> {
    // Delete all icon files
    await this.storage.deletePrefix(`assets/${appId}/icon`);

    // Update app
    await this.prisma.app.update({
      where: { id: appId },
      data: { icon_url: null },
    });

    this.logger.log(`Icon deleted for app: ${appId}`);
  }

  /**
   * Delete splash and all processed versions
   */
  async deleteSplash(appId: string): Promise<void> {
    // Delete all splash files
    await this.storage.deletePrefix(`assets/${appId}/splash`);

    // Update app
    await this.prisma.app.update({
      where: { id: appId },
      data: { splash_url: null },
    });

    this.logger.log(`Splash deleted for app: ${appId}`);
  }

  /**
   * Get signed download URL for an asset
   */
  async getSignedUrl(appId: string, assetType: 'icon' | 'splash'): Promise<string> {
    const app = await this.prisma.app.findUnique({
      where: { id: appId },
      select: { icon_url: true, splash_url: true },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    const key = assetType === 'icon' ? app.icon_url : app.splash_url;

    if (!key) {
      throw new NotFoundException(`${assetType} not uploaded`);
    }

    return this.storage.getSignedDownloadUrl(key, { expiresIn: 3600 });
  }
}
