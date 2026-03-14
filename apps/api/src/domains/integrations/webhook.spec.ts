import { createHmac } from 'node:crypto'
import type { Dependencies } from '@appfy/core'
import { EncryptionService } from '@appfy/core'
import { TenantBuilder, TenantRepositorySpy } from '@appfy/test-utils'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { errorHandler } from '../../middleware/error-handler.js'
import { createIntegrationHandlers } from './handlers.js'

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const ENCRYPTION_SECRET = 'test-32-char-encryption-secret!!'
const SHOPIFY_CLIENT_SECRET = 'shopify-webhook-secret-key'
const NUVEMSHOP_APP_SECRET = 'nuvemshop-webhook-secret-key'

function computeShopifyHmac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('base64')
}

function computeNuvemshopHmac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
}

interface MakeSutResult {
  app: Hono
  tenantRepoSpy: TenantRepositorySpy
  encryptionService: EncryptionService
}

async function makeSut(): Promise<MakeSutResult> {
  const tenantRepoSpy = new TenantRepositorySpy()
  const encryptionService = new EncryptionService(ENCRYPTION_SECRET)

  // Create a minimal deps object — only the fields used by webhook handler
  const deps = {
    tenantRepo: tenantRepoSpy,
    encryptionService,
  } as unknown as Dependencies

  const handlers = createIntegrationHandlers(deps)

  const app = new Hono()
  app.onError(errorHandler)
  app.post('/:platform/webhook', handlers.webhook)

  return { app, tenantRepoSpy, encryptionService }
}

async function buildTenantWithShopifyCredentials(encryptionService: EncryptionService) {
  const encrypted = await encryptionService.encrypt(
    JSON.stringify({ clientSecret: SHOPIFY_CLIENT_SECRET }),
  )
  return new TenantBuilder()
    .shopify()
    .withPlatformStoreUrl('test-store.myshopify.com')
    .withPlatformCredentials(encrypted)
    .build()
}

async function buildTenantWithNuvemshopCredentials(encryptionService: EncryptionService) {
  const encrypted = await encryptionService.encrypt(
    JSON.stringify({ webhookSecret: NUVEMSHOP_APP_SECRET }),
  )
  return new TenantBuilder()
    .nuvemshop()
    .withPlatformStoreUrl('test-store.nuvemshop.com')
    .withPlatformCredentials(encrypted)
    .build()
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('Webhook Handler (Layer 4 — HTTP)', () => {
  describe('unsupported platform', () => {
    it('should return 400 for unsupported platform', async () => {
      const { app } = await makeSut()
      const res = await app.request('/woocommerce/webhook', {
        method: 'POST',
        body: '{}',
      })

      expect(res.status).toBe(400)
      const body = await res.json() as { error: { code: string } }
      expect(body.error.code).toBe('UNSUPPORTED_PLATFORM')
    })
  })

  describe('missing headers', () => {
    it('should return 400 when Shopify HMAC header is missing', async () => {
      const { app } = await makeSut()
      const res = await app.request('/shopify/webhook', {
        method: 'POST',
        headers: {
          'X-Shopify-Topic': 'orders/paid',
          'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        },
        body: '{}',
      })

      expect(res.status).toBe(400)
      const body = await res.json() as { error: { code: string } }
      expect(body.error.code).toBe('MISSING_HEADERS')
    })

    it('should return 400 when Shopify topic header is missing', async () => {
      const { app } = await makeSut()
      const res = await app.request('/shopify/webhook', {
        method: 'POST',
        headers: {
          'X-Shopify-Hmac-Sha256': 'some-hmac',
          'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        },
        body: '{}',
      })

      expect(res.status).toBe(400)
      const body = await res.json() as { error: { code: string } }
      expect(body.error.code).toBe('MISSING_HEADERS')
    })

    it('should return 400 when Shopify shop domain header is missing', async () => {
      const { app } = await makeSut()
      const res = await app.request('/shopify/webhook', {
        method: 'POST',
        headers: {
          'X-Shopify-Hmac-Sha256': 'some-hmac',
          'X-Shopify-Topic': 'orders/paid',
        },
        body: '{}',
      })

      expect(res.status).toBe(400)
      const body = await res.json() as { error: { code: string } }
      expect(body.error.code).toBe('MISSING_HEADERS')
    })

    it('should return 400 when Nuvemshop headers are missing', async () => {
      const { app } = await makeSut()
      const res = await app.request('/nuvemshop/webhook', {
        method: 'POST',
        headers: {
          'X-Linkedstore-Topic': 'orders/created',
          'X-Linkedstore-Shop-Domain': 'test-store.nuvemshop.com',
        },
        body: '{}',
      })

      expect(res.status).toBe(400)
      const body = await res.json() as { error: { code: string } }
      expect(body.error.code).toBe('MISSING_HEADERS')
    })
  })

  describe('tenant lookup', () => {
    it('should return 404 when no tenant found for shop domain', async () => {
      const { app, tenantRepoSpy } = await makeSut()
      tenantRepoSpy.result = undefined

      const payload = JSON.stringify({ id: 123 })
      const hmac = computeShopifyHmac(payload, SHOPIFY_CLIENT_SECRET)

      const res = await app.request('/shopify/webhook', {
        method: 'POST',
        headers: {
          'X-Shopify-Hmac-Sha256': hmac,
          'X-Shopify-Topic': 'orders/paid',
          'X-Shopify-Shop-Domain': 'unknown-store.myshopify.com',
        },
        body: payload,
      })

      expect(res.status).toBe(404)
      const body = await res.json() as { error: { code: string } }
      expect(body.error.code).toBe('TENANT_NOT_FOUND')
      expect(tenantRepoSpy.wasCalled('findByPlatformUrl')).toBe(true)
    })
  })

  describe('missing credentials', () => {
    it('should return 422 when tenant has no platform credentials', async () => {
      const { app, tenantRepoSpy } = await makeSut()
      tenantRepoSpy.result = new TenantBuilder()
        .shopify()
        .withPlatformStoreUrl('test-store.myshopify.com')
        .build()

      const payload = JSON.stringify({ id: 123 })
      const hmac = computeShopifyHmac(payload, SHOPIFY_CLIENT_SECRET)

      const res = await app.request('/shopify/webhook', {
        method: 'POST',
        headers: {
          'X-Shopify-Hmac-Sha256': hmac,
          'X-Shopify-Topic': 'orders/paid',
          'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        },
        body: payload,
      })

      expect(res.status).toBe(422)
      const body = await res.json() as { error: { code: string } }
      expect(body.error.code).toBe('MISSING_CREDENTIALS')
    })
  })

  describe('HMAC verification', () => {
    it('should return 401 for invalid Shopify HMAC', async () => {
      const { app, tenantRepoSpy, encryptionService } = await makeSut()
      tenantRepoSpy.result = await buildTenantWithShopifyCredentials(encryptionService)

      const payload = JSON.stringify({ id: 123 })

      const res = await app.request('/shopify/webhook', {
        method: 'POST',
        headers: {
          'X-Shopify-Hmac-Sha256': 'invalid-hmac-value',
          'X-Shopify-Topic': 'orders/paid',
          'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        },
        body: payload,
      })

      expect(res.status).toBe(401)
      const body = await res.json() as { error: { code: string } }
      expect(body.error.code).toBe('INVALID_SIGNATURE')
    })

    it('should return 401 for invalid Nuvemshop HMAC', async () => {
      const { app, tenantRepoSpy, encryptionService } = await makeSut()
      tenantRepoSpy.result = await buildTenantWithNuvemshopCredentials(encryptionService)

      const payload = JSON.stringify({ id: 456 })

      const res = await app.request('/nuvemshop/webhook', {
        method: 'POST',
        headers: {
          'X-Linkedstore-Hmac-Sha256': 'invalid-hmac',
          'X-Linkedstore-Topic': 'orders/created',
          'X-Linkedstore-Shop-Domain': 'test-store.nuvemshop.com',
        },
        body: payload,
      })

      expect(res.status).toBe(401)
      const body = await res.json() as { error: { code: string } }
      expect(body.error.code).toBe('INVALID_SIGNATURE')
    })
  })

  describe('valid Shopify webhook', () => {
    it('should return 200 with topic and flow type for orders/paid', async () => {
      const { app, tenantRepoSpy, encryptionService } = await makeSut()
      tenantRepoSpy.result = await buildTenantWithShopifyCredentials(encryptionService)

      const payload = JSON.stringify({ id: 123, email: 'customer@test.com' })
      const hmac = computeShopifyHmac(payload, SHOPIFY_CLIENT_SECRET)

      const res = await app.request('/shopify/webhook', {
        method: 'POST',
        headers: {
          'X-Shopify-Hmac-Sha256': hmac,
          'X-Shopify-Topic': 'orders/paid',
          'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        },
        body: payload,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as {
        received: boolean
        topic: string
        flowType: string | null
        jobPayload: { tenantId: string; platform: string; queue: string }
      }
      expect(body.received).toBe(true)
      expect(body.topic).toBe('orders/paid')
      expect(body.flowType).toBe('order_confirmed')
      expect(body.jobPayload.tenantId).toBe(tenantRepoSpy.result!.id)
      expect(body.jobPayload.platform).toBe('shopify')
      expect(body.jobPayload.queue).toBe('data-ingestion')
    })

    it('should return 200 with flow type cart_abandoned for carts/create', async () => {
      const { app, tenantRepoSpy, encryptionService } = await makeSut()
      tenantRepoSpy.result = await buildTenantWithShopifyCredentials(encryptionService)

      const payload = JSON.stringify({ id: 456, line_items: [] })
      const hmac = computeShopifyHmac(payload, SHOPIFY_CLIENT_SECRET)

      const res = await app.request('/shopify/webhook', {
        method: 'POST',
        headers: {
          'X-Shopify-Hmac-Sha256': hmac,
          'X-Shopify-Topic': 'carts/create',
          'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        },
        body: payload,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as { flowType: string | null }
      expect(body.flowType).toBe('cart_abandoned')
    })

    it('should return null flowType for unmapped topics', async () => {
      const { app, tenantRepoSpy, encryptionService } = await makeSut()
      tenantRepoSpy.result = await buildTenantWithShopifyCredentials(encryptionService)

      const payload = JSON.stringify({ id: 789 })
      const hmac = computeShopifyHmac(payload, SHOPIFY_CLIENT_SECRET)

      const res = await app.request('/shopify/webhook', {
        method: 'POST',
        headers: {
          'X-Shopify-Hmac-Sha256': hmac,
          'X-Shopify-Topic': 'app/uninstalled',
          'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        },
        body: payload,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as { flowType: string | null }
      expect(body.flowType).toBeNull()
    })
  })

  describe('valid Nuvemshop webhook', () => {
    it('should return 200 with topic and flow type for orders/created', async () => {
      const { app, tenantRepoSpy, encryptionService } = await makeSut()
      tenantRepoSpy.result = await buildTenantWithNuvemshopCredentials(encryptionService)

      const payload = JSON.stringify({ id: 789, status: 'paid' })
      const hmac = computeNuvemshopHmac(payload, NUVEMSHOP_APP_SECRET)

      const res = await app.request('/nuvemshop/webhook', {
        method: 'POST',
        headers: {
          'X-Linkedstore-Hmac-Sha256': hmac,
          'X-Linkedstore-Topic': 'orders/created',
          'X-Linkedstore-Shop-Domain': 'test-store.nuvemshop.com',
        },
        body: payload,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as {
        received: boolean
        topic: string
        flowType: string | null
        jobPayload: { tenantId: string; platform: string }
      }
      expect(body.received).toBe(true)
      expect(body.topic).toBe('orders/created')
      expect(body.flowType).toBe('order_confirmed')
      expect(body.jobPayload.platform).toBe('nuvemshop')
    })

    it('should return checkout_abandoned flow for checkouts/created', async () => {
      const { app, tenantRepoSpy, encryptionService } = await makeSut()
      tenantRepoSpy.result = await buildTenantWithNuvemshopCredentials(encryptionService)

      const payload = JSON.stringify({ id: 101 })
      const hmac = computeNuvemshopHmac(payload, NUVEMSHOP_APP_SECRET)

      const res = await app.request('/nuvemshop/webhook', {
        method: 'POST',
        headers: {
          'X-Linkedstore-Hmac-Sha256': hmac,
          'X-Linkedstore-Topic': 'checkouts/created',
          'X-Linkedstore-Shop-Domain': 'test-store.nuvemshop.com',
        },
        body: payload,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as { flowType: string | null }
      expect(body.flowType).toBe('checkout_abandoned')
    })
  })

  describe('job payload structure', () => {
    it('should include all required fields in jobPayload', async () => {
      const { app, tenantRepoSpy, encryptionService } = await makeSut()
      const tenant = await buildTenantWithShopifyCredentials(encryptionService)
      tenantRepoSpy.result = tenant

      const payload = JSON.stringify({ id: 123 })
      const hmac = computeShopifyHmac(payload, SHOPIFY_CLIENT_SECRET)

      const res = await app.request('/shopify/webhook', {
        method: 'POST',
        headers: {
          'X-Shopify-Hmac-Sha256': hmac,
          'X-Shopify-Topic': 'fulfillments/create',
          'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        },
        body: payload,
      })

      expect(res.status).toBe(200)
      const body = await res.json() as {
        jobPayload: {
          tenantId: string
          platform: string
          topic: string
          flowType: string | null
          shopDomain: string
          data: unknown
          receivedAt: string
          queue: string
        }
      }

      expect(body.jobPayload.tenantId).toBe(tenant.id)
      expect(body.jobPayload.platform).toBe('shopify')
      expect(body.jobPayload.topic).toBe('fulfillments/create')
      expect(body.jobPayload.flowType).toBe('tracking_created')
      expect(body.jobPayload.shopDomain).toBe('test-store.myshopify.com')
      expect(body.jobPayload.data).toEqual({ id: 123 })
      expect(body.jobPayload.receivedAt).toBeDefined()
      expect(body.jobPayload.queue).toBe('data-ingestion')
    })
  })

  describe('tenant repo interaction', () => {
    it('should call findByPlatformUrl with the shop domain', async () => {
      const { app, tenantRepoSpy, encryptionService } = await makeSut()
      tenantRepoSpy.result = await buildTenantWithShopifyCredentials(encryptionService)

      const payload = JSON.stringify({ id: 1 })
      const hmac = computeShopifyHmac(payload, SHOPIFY_CLIENT_SECRET)

      await app.request('/shopify/webhook', {
        method: 'POST',
        headers: {
          'X-Shopify-Hmac-Sha256': hmac,
          'X-Shopify-Topic': 'orders/paid',
          'X-Shopify-Shop-Domain': 'my-store.myshopify.com',
        },
        body: payload,
      })

      expect(tenantRepoSpy.wasCalled('findByPlatformUrl')).toBe(true)
      expect(tenantRepoSpy.lastCallArgs('findByPlatformUrl')).toEqual(['my-store.myshopify.com'])
    })
  })
})
