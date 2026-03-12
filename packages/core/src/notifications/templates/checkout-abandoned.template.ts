import type { NotificationTemplate } from './types.js'

export const checkoutAbandonedTemplate: NotificationTemplate = {
  flowType: 'checkout_abandoned',
  title: '{{store_name}} - Finalize seu pedido!',
  body: 'Você estava quase lá! Complete seu pedido de {{order_total}} agora.',
  variables: ['store_name', 'order_total', 'checkout_url', 'product_name'],
}
