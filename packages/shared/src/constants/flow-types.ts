export const flowTypes = [
  'cart_abandoned',
  'pix_recovery',
  'boleto_recovery',
  'welcome',
  'checkout_abandoned',
  'order_confirmed',
  'tracking_created',
  'browse_abandoned',
  'upsell',
] as const

export type FlowType = (typeof flowTypes)[number]
