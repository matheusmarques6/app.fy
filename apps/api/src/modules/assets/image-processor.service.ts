import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import sharp from 'sharp';

interface IconSize {
  name: string;
  size: number;
}

// Android mipmap sizes
const ANDROID_ICON_SIZES: IconSize[] = [
  { name: 'mipmap-mdpi', size: 48 },
  { name: 'mipmap-hdpi', size: 72 },
  { name: 'mipmap-xhdpi', size: 96 },
  { name: 'mipmap-xxhdpi', size: 144 },
  { name: 'mipmap-xxxhdpi', size: 192 },
];

// iOS icon sizes (AppIcon.appiconset)
const IOS_ICON_SIZES: IconSize[] = [
  { name: '20@2x', size: 40 },
  { name: '20@3x', size: 60 },
  { name: '29@2x', size: 58 },
  { name: '29@3x', size: 87 },
  { name: '40@2x', size: 80 },
  { name: '40@3x', size: 120 },
  { name: '60@2x', size: 120 },
  { name: '60@3x', size: 180 },
  { name: '76', size: 76 },
  { name: '76@2x', size: 152 },
  { name: '83.5@2x', size: 167 },
  { name: '1024', size: 1024 },
];

export interface ProcessedIcons {
  /**
   * Android icons: key = "mipmap-xxxhdpi/ic_launcher.png", value = Buffer
   */
  android: Map<string, Buffer>;

  /**
   * iOS icons: key = "AppIcon60x60@3x.png", value = Buffer
   */
  ios: Map<string, Buffer>;

  /**
   * iOS Contents.json for AppIcon.appiconset
   */
  iosContentsJson: string;
}

@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);

  /**
   * Validate icon is PNG and 1024x1024
   */
  async validateIcon(buffer: Buffer): Promise<void> {
    try {
      const metadata = await sharp(buffer).metadata();

      if (metadata.format !== 'png') {
        throw new BadRequestException('Icon must be PNG format');
      }

      if (metadata.width !== 1024 || metadata.height !== 1024) {
        throw new BadRequestException(
          `Icon must be 1024x1024 pixels (got ${metadata.width}x${metadata.height})`,
        );
      }

      // Check for alpha channel (transparency)
      // iOS requires no transparency for App Store
      if (metadata.hasAlpha) {
        this.logger.warn(
          'Icon has transparency. iOS App Store requires no transparency.',
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Invalid image file: ${error}`);
    }
  }

  /**
   * Process app icon into all required sizes
   */
  async processAppIcon(iconBuffer: Buffer): Promise<ProcessedIcons> {
    const android = new Map<string, Buffer>();
    const ios = new Map<string, Buffer>();

    // Validate first
    await this.validateIcon(iconBuffer);

    // Process Android icons
    for (const { name, size } of ANDROID_ICON_SIZES) {
      const resized = await sharp(iconBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png()
        .toBuffer();

      android.set(`${name}/ic_launcher.png`, resized);

      // Also create round icon for Android
      const round = await this.createRoundIcon(iconBuffer, size);
      android.set(`${name}/ic_launcher_round.png`, round);
    }

    // Process iOS icons
    for (const { name, size } of IOS_ICON_SIZES) {
      const resized = await sharp(iconBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        // Remove alpha for iOS (App Store requirement)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .png()
        .toBuffer();

      ios.set(`AppIcon${name}.png`, resized);
    }

    // Generate iOS Contents.json
    const iosContentsJson = this.generateIosContentsJson();

    this.logger.log(
      `Processed icon: ${android.size} Android icons, ${ios.size} iOS icons`,
    );

    return { android, ios, iosContentsJson };
  }

  /**
   * Create a round icon (for Android adaptive icons)
   */
  private async createRoundIcon(iconBuffer: Buffer, size: number): Promise<Buffer> {
    // Create a circular mask
    const roundedCorners = Buffer.from(
      `<svg><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`,
    );

    return sharp(iconBuffer)
      .resize(size, size)
      .composite([
        {
          input: roundedCorners,
          blend: 'dest-in',
        },
      ])
      .png()
      .toBuffer();
  }

  /**
   * Generate iOS AppIcon.appiconset Contents.json
   */
  private generateIosContentsJson(): string {
    const images = [
      { size: '20x20', scale: '2x', filename: 'AppIcon20@2x.png' },
      { size: '20x20', scale: '3x', filename: 'AppIcon20@3x.png' },
      { size: '29x29', scale: '2x', filename: 'AppIcon29@2x.png' },
      { size: '29x29', scale: '3x', filename: 'AppIcon29@3x.png' },
      { size: '40x40', scale: '2x', filename: 'AppIcon40@2x.png' },
      { size: '40x40', scale: '3x', filename: 'AppIcon40@3x.png' },
      { size: '60x60', scale: '2x', filename: 'AppIcon60@2x.png' },
      { size: '60x60', scale: '3x', filename: 'AppIcon60@3x.png' },
      { size: '76x76', scale: '1x', filename: 'AppIcon76.png' },
      { size: '76x76', scale: '2x', filename: 'AppIcon76@2x.png' },
      { size: '83.5x83.5', scale: '2x', filename: 'AppIcon83.5@2x.png' },
      { size: '1024x1024', scale: '1x', filename: 'AppIcon1024.png' },
    ];

    const contents = {
      images: images.map((img) => ({
        size: img.size,
        idiom: 'universal',
        filename: img.filename,
        scale: img.scale,
      })),
      info: {
        version: 1,
        author: 'appfy',
      },
    };

    return JSON.stringify(contents, null, 2);
  }

  /**
   * Validate splash screen
   */
  async validateSplash(buffer: Buffer): Promise<void> {
    try {
      const metadata = await sharp(buffer).metadata();

      if (metadata.format !== 'png') {
        throw new BadRequestException('Splash screen must be PNG format');
      }

      // Recommended size is 2732x2732 (for iPad Pro)
      // But we accept anything >= 1242x2688 (iPhone 11 Pro Max)
      const minWidth = 1242;
      const minHeight = 2688;

      if (!metadata.width || !metadata.height) {
        throw new BadRequestException('Could not determine image dimensions');
      }

      if (metadata.width < minWidth || metadata.height < minHeight) {
        throw new BadRequestException(
          `Splash screen should be at least ${minWidth}x${minHeight} pixels (got ${metadata.width}x${metadata.height})`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Invalid image file: ${error}`);
    }
  }

  /**
   * Process splash screen into required sizes
   */
  async processSplash(splashBuffer: Buffer): Promise<Map<string, Buffer>> {
    const result = new Map<string, Buffer>();

    await this.validateSplash(splashBuffer);

    // Common splash sizes
    const sizes = [
      { name: 'splash-2732x2732.png', width: 2732, height: 2732 },
      { name: 'splash-1242x2688.png', width: 1242, height: 2688 },
      { name: 'splash-828x1792.png', width: 828, height: 1792 },
      { name: 'splash-1080x1920.png', width: 1080, height: 1920 },
      { name: 'splash-720x1280.png', width: 720, height: 1280 },
    ];

    for (const { name, width, height } of sizes) {
      const resized = await sharp(splashBuffer)
        .resize(width, height, {
          fit: 'cover',
          position: 'center',
        })
        .png()
        .toBuffer();

      result.set(name, resized);
    }

    this.logger.log(`Processed splash: ${result.size} sizes`);

    return result;
  }
}
