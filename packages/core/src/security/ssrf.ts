import { DomainError } from '../errors.js'

export class SsrfError extends DomainError {
  constructor(url: string, reason: string) {
    super(`SSRF blocked: ${reason} (${url})`, 'SSRF_BLOCKED')
  }
}

/** Allowed domain suffixes for outbound HTTP requests */
const ALLOWED_DOMAINS = [
  '.myshopify.com',
  '.nuvemshop.com',
  '.nuvemshop.com.br',
  'onesignal.com',
  'api.stripe.com',
  'api.klaviyo.com',
] as const

/** Private/reserved IP ranges (CIDR) */
const PRIVATE_RANGES = [
  { start: parseIp('10.0.0.0'), end: parseIp('10.255.255.255') },
  { start: parseIp('172.16.0.0'), end: parseIp('172.31.255.255') },
  { start: parseIp('192.168.0.0'), end: parseIp('192.168.255.255') },
  { start: parseIp('127.0.0.0'), end: parseIp('127.255.255.255') },
  { start: parseIp('169.254.0.0'), end: parseIp('169.254.255.255') },
  { start: parseIp('0.0.0.0'), end: parseIp('0.255.255.255') },
] as const

function parseIp(ip: string): number {
  const parts = ip.split('.')
  if (parts.length !== 4) return 0
  return parts.reduce((acc, octet) => (acc << 8) + Number.parseInt(octet, 10), 0) >>> 0
}

function isPrivateIp(hostname: string): boolean {
  // Handle IPv6 loopback
  if (hostname === '[::1]' || hostname === '::1') return true

  // Try to parse as IPv4
  const ip = parseIp(hostname)
  if (ip === 0 && hostname !== '0.0.0.0') return false

  return PRIVATE_RANGES.some((range) => ip >= range.start && ip <= range.end)
}

function isAllowedDomain(hostname: string): boolean {
  const lower = hostname.toLowerCase()

  return ALLOWED_DOMAINS.some((domain) => {
    if (domain.startsWith('.')) {
      // Suffix match: hostname must end with the domain AND have something before it
      // e.g., "store.myshopify.com" matches ".myshopify.com"
      // but "myshopify.com.evil.com" does NOT match ".myshopify.com"
      return lower.endsWith(domain) || lower === domain.slice(1)
    }
    // Exact match or subdomain match
    return lower === domain || lower.endsWith(`.${domain}`)
  })
}

/**
 * Validates a URL against SSRF protections.
 * Only allows whitelisted domains and blocks private IP ranges.
 *
 * @throws {SsrfError} if URL is blocked
 */
export function validateUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new SsrfError(url, 'Invalid URL')
  }

  // Only allow HTTPS (and HTTP for dev/testing)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new SsrfError(url, 'Invalid protocol')
  }

  const hostname = parsed.hostname

  // Block private IPs
  if (isPrivateIp(hostname)) {
    throw new SsrfError(url, 'Private IP address blocked')
  }

  // Check against allowed domain list
  if (!isAllowedDomain(hostname)) {
    throw new SsrfError(url, 'Domain not in allowlist')
  }
}

/**
 * Returns true if URL is safe, false otherwise. Non-throwing alternative.
 */
export function isUrlAllowed(url: string): boolean {
  try {
    validateUrl(url)
    return true
  } catch {
    return false
  }
}
