import type { NotificationTemplate } from './types.js'

export const browseAbandonedTemplate: NotificationTemplate = {
  flowType: 'browse_abandoned',
  title: '{{store_name}} - Vimos que você gostou!',
  body: '{{product_name}} ainda está disponível. Volte e aproveite!',
  variables: ['store_name', 'product_name', 'product_image_url', 'product_url'],
}
