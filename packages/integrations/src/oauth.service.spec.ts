import { describe, expect, it } from 'vitest'
import { buildNuvemshopOAuthUrl, buildShopifyOAuthUrl } from './oauth.service.js'
import type { OAuthConfig } from './oauth.service.js'

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

const oauthConfig: OAuthConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'https://console.appfy.com/callback',
}

describe('buildShopifyOAuthUrl', () => {
  it('should include client_id, scopes, and redirect_uri', () => {
    const url = buildShopifyOAuthUrl('test-store.myshopify.com', oauthConfig, [
      'read_products',
      'read_orders',
    ])

    expect(url).toContain('https://test-store.myshopify.com/admin/oauth/authorize')
    expect(url).toContain('client_id=test-client-id')
    expect(url).toContain('scope=read_products%2Cread_orders')
    expect(url).toContain('redirect_uri=https%3A%2F%2Fconsole.appfy.com%2Fcallback')
  })

  it('should use the provided shop domain', () => {
    const url = buildShopifyOAuthUrl('another-store.myshopify.com', oauthConfig, ['read_products'])

    expect(url).toContain('https://another-store.myshopify.com/admin/oauth/authorize')
  })

  it('should handle single scope', () => {
    const url = buildShopifyOAuthUrl('test-store.myshopify.com', oauthConfig, ['read_products'])

    expect(url).toContain('scope=read_products')
    expect(url).not.toContain('%2C')
  })
})

describe('buildNuvemshopOAuthUrl', () => {
  it('should include client_id, redirect_uri, and response_type=code', () => {
    const url = buildNuvemshopOAuthUrl(oauthConfig)

    expect(url).toContain('https://www.nuvemshop.com.br/apps/authorize/authorize')
    expect(url).toContain('client_id=test-client-id')
    expect(url).toContain('redirect_uri=https%3A%2F%2Fconsole.appfy.com%2Fcallback')
    expect(url).toContain('response_type=code')
  })
})
