import type { NotificationTemplate } from './types.js'

export const upsellTemplate: NotificationTemplate = {
  flowType: 'upsell',
  title: '{{store_name}} - Oferta especial para você!',
  body: 'Baseado na sua última compra, achamos que você vai adorar {{product_name}}!',
  variables: ['store_name', 'product_name', 'product_image_url', 'product_url', 'discount_code'],
}
