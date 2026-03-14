// ──────────────────────────────────────────────
// OAuth helpers for platform integrations
// ──────────────────────────────────────────────

export interface OAuthConfig {
  readonly clientId: string
  readonly clientSecret: string
  readonly redirectUri: string
}

export interface OAuthTokenResponse {
  readonly accessToken: string
  readonly scope: string
  readonly expiresAt?: Date
}

/**
 * Build Shopify OAuth authorization URL.
 *
 * @param shopDomain - e.g. "my-store.myshopify.com"
 * @param config - OAuth client credentials
 * @param scopes - Shopify permission scopes (e.g. ["read_products", "read_orders"])
 */
export function buildShopifyOAuthUrl(
  shopDomain: string,
  config: OAuthConfig,
  scopes: string[],
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    scope: scopes.join(','),
    redirect_uri: config.redirectUri,
  })
  return `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`
}

/**
 * Build Nuvemshop OAuth authorization URL.
 *
 * @param config - OAuth client credentials
 */
export function buildNuvemshopOAuthUrl(config: OAuthConfig): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
  })
  return `https://www.nuvemshop.com.br/apps/authorize/authorize?${params.toString()}`
}
