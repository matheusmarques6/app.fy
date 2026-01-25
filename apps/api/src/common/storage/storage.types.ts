/**
 * Storage Service Types
 *
 * Types for S3/Cloudflare R2 storage operations
 */

export interface UploadOptions {
  /**
   * Content type (MIME type) of the file
   */
  contentType?: string;

  /**
   * Cache-Control header value
   */
  cacheControl?: string;

  /**
   * Custom metadata to store with the object
   */
  metadata?: Record<string, string>;
}

export interface UploadResult {
  /**
   * The S3 key where the file was uploaded
   */
  key: string;

  /**
   * The full S3 URI (s3://bucket/key)
   */
  uri: string;
}

export interface SignedUrlOptions {
  /**
   * Expiration time in seconds (default: 3600 = 1 hour)
   */
  expiresIn?: number;

  /**
   * Content-Disposition header for download
   */
  responseContentDisposition?: string;
}

export interface ListOptions {
  /**
   * Prefix to filter objects
   */
  prefix?: string;

  /**
   * Maximum number of objects to return
   */
  maxKeys?: number;

  /**
   * Continuation token for pagination
   */
  continuationToken?: string;
}

export interface ListResult {
  /**
   * List of object keys
   */
  keys: string[];

  /**
   * Token for next page (if any)
   */
  nextContinuationToken?: string;

  /**
   * Whether there are more results
   */
  isTruncated: boolean;
}
