import type { Dependencies } from '@appfy/core'
import type { Context } from 'hono'
import type { ConnectBody } from './schemas.js'

export function createIntegrationHandlers(_deps: Dependencies) {
  return {
    /** GET /integrations — List connected integrations */
    async list(c: Context) {
      // tenantId will be used to query integration credentials
      void c.get('tenantId')
      // TODO: Query integration credentials for tenant
      return c.json({ data: [] })
    },

    /** POST /integrations/:platform/connect — Start OAuth flow */
    async connect(c: Context) {
      // tenantId will be used to store the OAuth state
      void c.get('tenantId')
      const platform = c.req.param('platform')
      const body = c.get('validatedBody' as never) as ConnectBody

      // TODO: Generate OAuth URL for the platform
      return c.json({
        data: {
          authUrl: `https://${platform}.com/oauth/authorize?redirect=${body.redirectUrl}`,
        },
      })
    },

    /** GET /integrations/:platform/callback — OAuth callback */
    async callback(c: Context) {
      const platform = c.req.param('platform')
      const code = c.req.query('code')

      if (!code) {
        return c.json(
          { error: { code: 'MISSING_CODE', message: 'Missing authorization code' } },
          400,
        )
      }

      // TODO: Exchange code for access token, store encrypted credentials
      return c.json({ data: { connected: true, platform } })
    },

    /** POST /integrations/:platform/webhook — Webhook receiver (no auth) */
    async webhook(c: Context) {
      // Read platform and body for future HMAC verification + ingestion
      void c.req.param('platform')
      void await c.req.text()

      // TODO: Verify HMAC signature per platform
      // TODO: Enqueue data ingestion job
      return c.json({ received: true })
    },
  }
}
