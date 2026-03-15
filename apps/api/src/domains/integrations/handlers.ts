import type { Dependencies } from '@appfy/core'
import {
  mapWebhookToFlowType,
  verifyNuvemshopWebhook,
  verifyShopifyWebhook,
} from '@appfy/integrations'
import { QUEUE_NAMES } from '@appfy/shared'
import type { Context } from 'hono'
import type { ConnectBody } from './schemas.js'

/** Headers sent by each platform on webhook requests */
interface PlatformHeaders {
  readonly hmac: string | undefined
  readonly topic: string | undefined
  readonly shopDomain: string | undefined
}

function extractPlatformHeaders(c: Context, platform: string): PlatformHeaders | null {
  if (platform === 'shopify') {
    return {
      hmac: c.req.header('X-Shopify-Hmac-Sha256'),
      topic: c.req.header('X-Shopify-Topic'),
      shopDomain: c.req.header('X-Shopify-Shop-Domain'),
    }
  }
  if (platform === 'nuvemshop') {
    return {
      hmac: c.req.header('X-Linkedstore-Hmac-Sha256'),
      topic: c.req.header('X-Linkedstore-Topic'),
      shopDomain: c.req.header('X-Linkedstore-Shop-Domain'),
    }
  }
  return null
}

export function createIntegrationHandlers(deps: Dependencies) {
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
      const platform = c.req.param('platform')
      const rawBody = await c.req.text()

      // 1. Validate platform is supported
      const headers = extractPlatformHeaders(c, platform!)
      if (!headers) {
        return c.json(
          { error: { code: 'UNSUPPORTED_PLATFORM', message: `Unsupported platform: ${platform}` } },
          400,
        )
      }

      // 2. Validate required headers
      if (!headers.hmac || !headers.topic) {
        return c.json(
          {
            error: {
              code: 'MISSING_HEADERS',
              message: 'Missing required webhook headers (hmac, topic)',
            },
          },
          400,
        )
      }

      if (!headers.shopDomain) {
        return c.json(
          {
            error: {
              code: 'MISSING_HEADERS',
              message: 'Missing required webhook headers (shop domain)',
            },
          },
          400,
        )
      }

      // 3. Look up tenant by platform store URL to get HMAC secret
      const tenant = await deps.tenantRepo.findByPlatformUrl(headers.shopDomain)
      if (!tenant) {
        return c.json(
          { error: { code: 'TENANT_NOT_FOUND', message: 'No tenant found for this shop domain' } },
          404,
        )
      }

      // 4. Decrypt platform credentials to get the webhook secret
      let webhookSecret: string
      try {
        if (!tenant.platformCredentials) {
          return c.json(
            {
              error: {
                code: 'MISSING_CREDENTIALS',
                message: 'No platform credentials configured for this tenant',
              },
            },
            422,
          )
        }
        const decrypted = await deps.encryptionService.decrypt(
          tenant.platformCredentials as { ct: string; iv: string; tag: string; alg: 'aes-256-gcm' },
        )
        const credentials = JSON.parse(decrypted) as Record<string, string>
        webhookSecret = credentials.webhookSecret ?? credentials.clientSecret ?? ''
      } catch {
        return c.json(
          {
            error: { code: 'CREDENTIAL_ERROR', message: 'Failed to decrypt platform credentials' },
          },
          500,
        )
      }

      // 5. Verify HMAC signature
      const verifyFn = platform === 'shopify' ? verifyShopifyWebhook : verifyNuvemshopWebhook
      const isValid = verifyFn(rawBody, headers.hmac, webhookSecret)

      if (!isValid) {
        return c.json(
          { error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' } },
          401,
        )
      }

      // 6. Map topic to flow type
      const flowType = mapWebhookToFlowType(headers.topic)

      // 7. Parse body
      let data: unknown
      try {
        data = JSON.parse(rawBody)
      } catch {
        data = rawBody
      }

      // 8. Build job payload for the data-ingestion queue
      const jobPayload = {
        tenantId: tenant.id,
        platform,
        topic: headers.topic,
        flowType: flowType ?? null,
        shopDomain: headers.shopDomain,
        data,
        receivedAt: new Date().toISOString(),
        queue: QUEUE_NAMES.dataIngestion,
      }

      try {
        await deps.dataIngestionQueue.add(QUEUE_NAMES.dataIngestion, jobPayload, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        })
      } catch {
        return c.json(
          {
            error: {
              code: 'QUEUE_UNAVAILABLE',
              message: 'Failed to enqueue webhook for processing',
            },
          },
          503,
        )
      }

      return c.json({ received: true })
    },
  }
}
