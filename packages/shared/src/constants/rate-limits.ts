/** Rate limiting configuration */
export const RATE_LIMITS = Object.freeze({
  /** Admin API: 100 requests per minute */
  admin: {
    windowMs: 60_000,
    maxRequests: 100,
  },
  /** Public API: 20 requests per second */
  public: {
    windowMs: 1_000,
    maxRequests: 20,
  },
} as const)
