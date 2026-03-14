/** Authentication configuration constants */
export const AUTH_CONFIG = Object.freeze({
  /** JWT token expiry in seconds (1 hour) */
  tokenExpirySeconds: 3600,
  /** Refresh token expiry in seconds (7 days) */
  refreshTokenExpirySeconds: 604800,
  /** JWT issuer */
  issuer: 'appfy',
  /** JWT audience for console users */
  audienceConsole: 'console',
  /** JWT audience for device SDK */
  audienceDevice: 'device',
})
