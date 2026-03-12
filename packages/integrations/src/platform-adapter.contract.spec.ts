import { beforeEach, describe, expect, it } from 'vitest'
import { NuvemshopAdapter } from './nuvemshop/adapter.js'
import type { NuvemshopConfig } from './nuvemshop/types.js'
import type { PlatformAdapter } from './platform-adapter.interface.js'
import { ShopifyAdapter } from './shopify/adapter.js'
import type { ShopifyConfig } from './shopify/types.js'

// ──────────────────────────────────────────────
// Contract test factory
// ──────────────────────────────────────────────

function platformAdapterContractTest(name: string, factory: () => PlatformAdapter): void {
  describe(`PlatformAdapter contract: ${name}`, () => {
    let adapter: PlatformAdapter

    beforeEach(() => {
      adapter = factory()
    })

    it('should expose a platform identifier', () => {
      expect(adapter.platform).toBeDefined()
      expect(typeof adapter.platform).toBe('string')
      expect(adapter.platform.length).toBeGreaterThan(0)
    })

    it('should implement getProducts', () => {
      expect(typeof adapter.getProducts).toBe('function')
    })

    it('should implement getOrders', () => {
      expect(typeof adapter.getOrders).toBe('function')
    })

    it('should implement getAbandonedCarts', () => {
      expect(typeof adapter.getAbandonedCarts).toBe('function')
    })

    it('should implement getCustomer', () => {
      expect(typeof adapter.getCustomer).toBe('function')
    })

    it('should implement registerWebhooks', () => {
      expect(typeof adapter.registerWebhooks).toBe('function')
    })

    it('should throw "not implemented" on getProducts call', () => {
      expect(() => adapter.getProducts({})).toThrow(/not implemented/i)
    })

    it('should throw "not implemented" on getOrders call', () => {
      expect(() => adapter.getOrders({})).toThrow(/not implemented/i)
    })

    it('should throw "not implemented" on getAbandonedCarts call', () => {
      expect(() => adapter.getAbandonedCarts()).toThrow(/not implemented/i)
    })

    it('should throw "not implemented" on getCustomer call', () => {
      expect(() => adapter.getCustomer('test-id')).toThrow(/not implemented/i)
    })

    it('should throw "not implemented" on registerWebhooks call', () => {
      expect(() => adapter.registerWebhooks([])).toThrow(/not implemented/i)
    })
  })
}

// ──────────────────────────────────────────────
// Run contract tests for each adapter
// ──────────────────────────────────────────────

const shopifyConfig: ShopifyConfig = {
  shopDomain: 'test-store.myshopify.com',
  accessToken: 'shpat_test_token',
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
}

const nuvemshopConfig: NuvemshopConfig = {
  shopDomain: 'test-store.nuvemshop.com',
  accessToken: 'ns_test_token',
  appId: 'test-app-id',
  appSecret: 'test-app-secret',
}

platformAdapterContractTest('Shopify', () => new ShopifyAdapter(shopifyConfig))
platformAdapterContractTest('Nuvemshop', () => new NuvemshopAdapter(nuvemshopConfig))

// ──────────────────────────────────────────────
// Domain validation tests
// ──────────────────────────────────────────────

describe('ShopifyAdapter domain validation', () => {
  it('should reject invalid Shopify domains', () => {
    expect(
      () =>
        new ShopifyAdapter({
          ...shopifyConfig,
          shopDomain: 'evil.example.com',
        }),
    ).toThrow(/Invalid Shopify domain/)
  })

  it('should accept valid Shopify domains', () => {
    const adapter = new ShopifyAdapter(shopifyConfig)
    expect(adapter.platform).toBe('shopify')
  })
})

describe('NuvemshopAdapter domain validation', () => {
  it('should reject invalid Nuvemshop domains', () => {
    expect(
      () =>
        new NuvemshopAdapter({
          ...nuvemshopConfig,
          shopDomain: 'evil.example.com',
        }),
    ).toThrow(/Invalid Nuvemshop domain/)
  })

  it('should accept valid *.nuvemshop.com domains', () => {
    const adapter = new NuvemshopAdapter(nuvemshopConfig)
    expect(adapter.platform).toBe('nuvemshop')
  })

  it('should accept valid *.lojavirtualnuvem.com.br domains', () => {
    const adapter = new NuvemshopAdapter({
      ...nuvemshopConfig,
      shopDomain: 'minha-loja.lojavirtualnuvem.com.br',
    })
    expect(adapter.platform).toBe('nuvemshop')
  })
})
