/**
 * Validation utilities for security and data integrity
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_HASH_REGEX = /^[a-f0-9]{64}$/i; // SHA-256 hex
const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function isValidEmailHash(value: string): boolean {
  return EMAIL_HASH_REGEX.test(value);
}

export function isValidDomain(value: string): boolean {
  return DOMAIN_REGEX.test(value);
}

/**
 * Sanitize and validate internal route for bridge navigation
 * Blocks: absolute URLs, javascript:, file:, .., double encoding
 */
export function sanitizeInternalRoute(route: string): string | null {
  if (!route || typeof route !== 'string') return null;

  // Block absolute URLs
  if (/^https?:\/\//i.test(route)) return null;

  // Block dangerous schemes
  if (/^(javascript|file|data|vbscript):/i.test(route)) return null;

  // Must start with /
  if (!route.startsWith('/')) return null;

  // Decode and check for path traversal
  let decoded: string;
  try {
    decoded = decodeURIComponent(route);
    // Check for double encoding
    if (decoded !== decodeURIComponent(decoded)) return null;
  } catch {
    return null; // Invalid encoding
  }

  // Block path traversal
  if (decoded.includes('..')) return null;

  // Block double slashes (except at start which we'll normalize)
  if (/\/\/+/.test(decoded.replace(/^\//, ''))) return null;

  // Block control characters
  if (/[\x00-\x1f\x7f]/.test(decoded)) return null;

  // Normalize: ensure single leading slash, lowercase
  const normalized = '/' + decoded.replace(/^\/+/, '').toLowerCase();

  return normalized;
}

/**
 * Validate event props size and structure
 */
export function validateEventProps(
  props: Record<string, unknown>,
  maxSizeBytes: number = 16384 // 16KB default
): { valid: boolean; error?: string } {
  const json = JSON.stringify(props);

  if (json.length > maxSizeBytes) {
    return { valid: false, error: `Props exceeds max size of ${maxSizeBytes} bytes` };
  }

  // Check depth (max 5 levels)
  const depth = getObjectDepth(props);
  if (depth > 5) {
    return { valid: false, error: 'Props exceeds max depth of 5' };
  }

  // Check number of keys (max 50)
  const keyCount = countKeys(props);
  if (keyCount > 50) {
    return { valid: false, error: 'Props exceeds max key count of 50' };
  }

  return { valid: true };
}

function getObjectDepth(obj: unknown, current = 0): number {
  if (typeof obj !== 'object' || obj === null) return current;
  if (Array.isArray(obj)) {
    return Math.max(current, ...obj.map(item => getObjectDepth(item, current + 1)));
  }
  return Math.max(
    current,
    ...Object.values(obj).map(value => getObjectDepth(value, current + 1))
  );
}

function countKeys(obj: unknown): number {
  if (typeof obj !== 'object' || obj === null) return 0;
  if (Array.isArray(obj)) {
    return obj.reduce((sum, item) => sum + countKeys(item), 0);
  }
  const keys = Object.keys(obj);
  return keys.length + keys.reduce((sum, key) => sum + countKeys((obj as Record<string, unknown>)[key]), 0);
}

/**
 * Validate timestamp is within acceptable range
 */
export function isValidEventTimestamp(
  ts: string,
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000, // 7 days
  maxFutureMs: number = 5 * 60 * 1000 // 5 minutes
): boolean {
  const date = new Date(ts);
  if (isNaN(date.getTime())) return false;

  const now = Date.now();
  const eventTime = date.getTime();

  if (eventTime < now - maxAgeMs) return false;
  if (eventTime > now + maxFutureMs) return false;

  return true;
}
