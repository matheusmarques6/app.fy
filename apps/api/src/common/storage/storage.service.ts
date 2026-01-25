import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  UploadOptions,
  UploadResult,
  SignedUrlOptions,
  ListOptions,
  ListResult,
} from './storage.types';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly isConfigured: boolean;

  constructor(private readonly config: ConfigService) {
    const bucket = config.get<string>('S3_BUCKET');
    const accessKeyId = config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('S3_SECRET_ACCESS_KEY');

    this.isConfigured = !!(bucket && accessKeyId && secretAccessKey);

    if (this.isConfigured) {
      this.bucket = bucket!;
      this.s3 = new S3Client({
        region: config.get('S3_REGION', 'auto'),
        endpoint: config.get('S3_ENDPOINT'),
        credentials: {
          accessKeyId: accessKeyId!,
          secretAccessKey: secretAccessKey!,
        },
        // Required for Cloudflare R2
        forcePathStyle: true,
      });
    } else {
      this.bucket = '';
      this.s3 = null as unknown as S3Client;
    }
  }

  onModuleInit() {
    if (!this.isConfigured) {
      this.logger.warn(
        'Storage service not configured. S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required.',
      );
    } else {
      this.logger.log(`Storage service configured with bucket: ${this.bucket}`);
    }
  }

  /**
   * Check if storage is properly configured
   */
  isEnabled(): boolean {
    return this.isConfigured;
  }

  /**
   * Upload a file to S3
   */
  async upload(
    key: string,
    data: Buffer,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    this.ensureConfigured();

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: options.contentType,
        CacheControl: options.cacheControl,
        Metadata: options.metadata,
      }),
    );

    this.logger.debug(`Uploaded file to ${key}`);

    return {
      key,
      uri: `s3://${this.bucket}/${key}`,
    };
  }

  /**
   * Download a file from S3
   */
  async download(key: string): Promise<Buffer> {
    this.ensureConfigured();

    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`No body returned for key: ${key}`);
    }

    return Buffer.from(await response.Body.transformToByteArray());
  }

  /**
   * Check if an object exists
   */
  async exists(key: string): Promise<boolean> {
    this.ensureConfigured();

    try {
      await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'name' in error &&
        error.name === 'NotFound'
      ) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Delete a file from S3
   */
  async delete(key: string): Promise<void> {
    this.ensureConfigured();

    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    this.logger.debug(`Deleted file: ${key}`);
  }

  /**
   * Delete multiple files with a prefix
   */
  async deletePrefix(prefix: string): Promise<number> {
    this.ensureConfigured();

    const { keys } = await this.list({ prefix, maxKeys: 1000 });
    let deleted = 0;

    for (const key of keys) {
      await this.delete(key);
      deleted++;
    }

    this.logger.debug(`Deleted ${deleted} files with prefix: ${prefix}`);
    return deleted;
  }

  /**
   * List objects in S3
   */
  async list(options: ListOptions = {}): Promise<ListResult> {
    this.ensureConfigured();

    const response = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: options.prefix,
        MaxKeys: options.maxKeys,
        ContinuationToken: options.continuationToken,
      }),
    );

    return {
      keys: (response.Contents || []).map((obj) => obj.Key!),
      nextContinuationToken: response.NextContinuationToken,
      isTruncated: response.IsTruncated || false,
    };
  }

  /**
   * Generate a pre-signed URL for downloading
   */
  async getSignedDownloadUrl(
    key: string,
    options: SignedUrlOptions = {},
  ): Promise<string> {
    this.ensureConfigured();

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: options.responseContentDisposition,
    });

    return getSignedUrl(this.s3, command, {
      expiresIn: options.expiresIn || 3600,
    });
  }

  /**
   * Generate a pre-signed URL for uploading
   */
  async getSignedUploadUrl(
    key: string,
    contentType: string,
    options: SignedUrlOptions = {},
  ): Promise<string> {
    this.ensureConfigured();

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.s3, command, {
      expiresIn: options.expiresIn || 3600,
    });
  }

  /**
   * Get the public URL for an object (if bucket is public)
   */
  getPublicUrl(key: string): string {
    const endpoint = this.config.get<string>('S3_PUBLIC_URL');
    if (endpoint) {
      return `${endpoint}/${key}`;
    }
    // Default S3 URL format
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  /**
   * Ensure storage is configured before operations
   */
  private ensureConfigured(): void {
    if (!this.isConfigured) {
      throw new Error(
        'Storage service is not configured. Please set S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.',
      );
    }
  }
}
