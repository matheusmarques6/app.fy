import type { NotificationTemplate } from './types.js'

export const trackingCreatedTemplate: NotificationTemplate = {
  flowType: 'tracking_created',
  title: '{{store_name}} - Seu pedido foi enviado!',
  body: 'Pedido #{{order_number}} está a caminho! Código de rastreio: {{tracking_code}}',
  variables: ['store_name', 'order_number', 'tracking_code', 'tracking_url'],
}
