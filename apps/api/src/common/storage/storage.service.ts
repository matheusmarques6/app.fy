import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
  private readonly supabase: SupabaseClient;
  private readonly bucketAssets: string;
  private readonly bucketLogs: string;
  private readonly isConfigured: boolean;

  constructor(private readonly config: ConfigService) {
    const supabaseUrl = config.get<string>('SUPABASE_URL');
    const serviceRoleKey = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    this.bucketAssets = config.get<string>('SUPABASE_STORAGE_BUCKET_ASSETS', 'appfy-assets');
    this.bucketLogs = config.get<string>('SUPABASE_STORAGE_BUCKET_LOGS', 'appfy-logs');

    this.isConfigured = !!(supabaseUrl && serviceRoleKey);

    if (this.isConfigured) {
      this.supabase = createClient(supabaseUrl!, serviceRoleKey!, {
        auth: { persistSession: false },
      });
    } else {
      this.supabase = null as unknown as SupabaseClient;
    }
  }

  onModuleInit() {
    if (!this.isConfigured) {
      this.logger.warn(
        'Storage service not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.',
      );
    } else {
      this.logger.log(
        `Supabase Storage configured. Buckets: ${this.bucketAssets}, ${this.bucketLogs}`,
      );
    }
  }

  isEnabled(): boolean {
    return this.isConfigured;
  }

  async upload(
    key: string,
    data: Buffer,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    this.ensureConfigured();

    const bucket = this.resolveBucket(key);
    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(key, data, {
        contentType: options.contentType,
        cacheControl: options.cacheControl ?? '3600',
        upsert: true,
        metadata: options.metadata,
      });

    if (error) {
      throw new Error(`Storage upload failed for key "${key}": ${error.message}`);
    }

    this.logger.debug(`Uploaded file to ${bucket}/${key}`);

    return {
      key,
      uri: `supabase://${bucket}/${key}`,
    };
  }

  async download(key: string): Promise<Buffer> {
    this.ensureConfigured();

    const bucket = this.resolveBucket(key);
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .download(key);

    if (error || !data) {
      throw new Error(`Storage download failed for key "${key}": ${error?.message}`);
    }

    return Buffer.from(await data.arrayBuffer());
  }

  async exists(key: string): Promise<boolean> {
    this.ensureConfigured();

    const bucket = this.resolveBucket(key);
    const folder = key.split('/').slice(0, -1).join('/') || '';
    const filename = key.split('/').pop()!;

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .list(folder, { search: filename });

    if (error) return false;
    return (data ?? []).some((f) => f.name === filename);
  }

  async delete(key: string): Promise<void> {
    this.ensureConfigured();

    const bucket = this.resolveBucket(key);
    const { error } = await this.supabase.storage
      .from(bucket)
      .remove([key]);

    if (error) {
      throw new Error(`Storage delete failed for key "${key}": ${error.message}`);
    }

    this.logger.debug(`Deleted file: ${bucket}/${key}`);
  }

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

  async list(options: ListOptions = {}): Promise<ListResult> {
    this.ensureConfigured();

    const bucket = this.resolveBucket(options.prefix ?? '');
    const folder = options.prefix
      ? options.prefix.split('/').slice(0, -1).join('/')
      : '';

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .list(folder, {
        limit: options.maxKeys ?? 100,
        offset: 0,
        search: options.prefix?.split('/').pop(),
      });

    if (error) {
      throw new Error(`Storage list failed: ${error.message}`);
    }

    const keys = (data ?? [])
      .filter((f) => f.name !== '.emptyFolderPlaceholder')
      .map((f) => (folder ? `${folder}/${f.name}` : f.name));

    return {
      keys,
      isTruncated: keys.length === (options.maxKeys ?? 100),
    };
  }

  async getSignedDownloadUrl(
    key: string,
    options: SignedUrlOptions = {},
  ): Promise<string> {
    this.ensureConfigured();

    const bucket = this.resolveBucket(key);
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(key, options.expiresIn ?? 3600, {
        download: options.responseContentDisposition
          ? true
          : undefined,
      });

    if (error || !data) {
      throw new Error(`Failed to create signed URL for "${key}": ${error?.message}`);
    }

    return data.signedUrl;
  }

  async getSignedUploadUrl(
    key: string,
    _contentType: string,
    options: SignedUrlOptions = {},
  ): Promise<string> {
    this.ensureConfigured();

    const bucket = this.resolveBucket(key);
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUploadUrl(key, { upsert: true });

    if (error || !data) {
      throw new Error(`Failed to create signed upload URL for "${key}": ${error?.message}`);
    }

    return data.signedUrl;
  }

  getPublicUrl(key: string): string {
    this.ensureConfigured();

    const bucket = this.resolveBucket(key);
    const { data } = this.supabase.storage.from(bucket).getPublicUrl(key);
    return data.publicUrl;
  }

  private resolveBucket(key: string): string {
    if (key.startsWith('logs/')) return this.bucketLogs;
    return this.bucketAssets;
  }

  private ensureConfigured(): void {
    if (!this.isConfigured) {
      throw new Error(
        'Storage service is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }
  }
}
