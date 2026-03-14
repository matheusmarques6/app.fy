import { describe, expect, it } from 'vitest'
import { mapWebhookToFlowType, WEBHOOK_FLOW_MAP } from './webhook-flow-map.js'

describe('WEBHOOK_FLOW_MAP', () => {
  it('should map all expected Shopify topics', () => {
    expect(WEBHOOK_FLOW_MAP['orders/create']).toBe('order_confirmed')
    expect(WEBHOOK_FLOW_MAP['orders/paid']).toBe('order_confirmed')
    expect(WEBHOOK_FLOW_MAP['carts/create']).toBe('cart_abandoned')
    expect(WEBHOOK_FLOW_MAP['checkouts/create']).toBe('checkout_abandoned')
    expect(WEBHOOK_FLOW_MAP['fulfillments/create']).toBe('tracking_created')
  })

  it('should map all expected Nuvemshop topics', () => {
    expect(WEBHOOK_FLOW_MAP['orders/created']).toBe('order_confirmed')
    expect(WEBHOOK_FLOW_MAP['carts/created']).toBe('cart_abandoned')
    expect(WEBHOOK_FLOW_MAP['checkouts/created']).toBe('checkout_abandoned')
    expect(WEBHOOK_FLOW_MAP['fulfillments/created']).toBe('tracking_created')
  })

  it('should return undefined for unmapped topics', () => {
    expect(WEBHOOK_FLOW_MAP['app/uninstalled']).toBeUndefined()
    expect(WEBHOOK_FLOW_MAP['orders/cancelled']).toBeUndefined()
    expect(WEBHOOK_FLOW_MAP['unknown/topic']).toBeUndefined()
  })
})

describe('mapWebhookToFlowType', () => {
  it('should return flow type for known Shopify topics', () => {
    expect(mapWebhookToFlowType('orders/paid')).toBe('order_confirmed')
    expect(mapWebhookToFlowType('carts/create')).toBe('cart_abandoned')
    expect(mapWebhookToFlowType('checkouts/create')).toBe('checkout_abandoned')
    expect(mapWebhookToFlowType('fulfillments/create')).toBe('tracking_created')
  })

  it('should return flow type for known Nuvemshop topics', () => {
    expect(mapWebhookToFlowType('orders/created')).toBe('order_confirmed')
    expect(mapWebhookToFlowType('carts/created')).toBe('cart_abandoned')
    expect(mapWebhookToFlowType('checkouts/created')).toBe('checkout_abandoned')
    expect(mapWebhookToFlowType('fulfillments/created')).toBe('tracking_created')
  })

  it('should return undefined for unknown topics', () => {
    expect(mapWebhookToFlowType('app/uninstalled')).toBeUndefined()
    expect(mapWebhookToFlowType('')).toBeUndefined()
    expect(mapWebhookToFlowType('nonexistent')).toBeUndefined()
  })

  it('should handle orders/paid mapping (shared between platforms)', () => {
    // orders/paid is used by both Shopify and Nuvemshop
    expect(mapWebhookToFlowType('orders/paid')).toBe('order_confirmed')
  })
}
)
