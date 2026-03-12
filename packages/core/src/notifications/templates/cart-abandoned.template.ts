import type { NotificationTemplate } from './types.js'

export const cartAbandonedTemplate: NotificationTemplate = {
  flowType: 'cart_abandoned',
  title: '{{store_name}} - Você esqueceu algo!',
  body: '{{product_name}} está esperando por você. Finalize sua compra agora!',
  variables: ['store_name', 'product_name', 'product_image_url', 'checkout_url'],
}
