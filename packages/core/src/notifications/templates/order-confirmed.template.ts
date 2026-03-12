import type { NotificationTemplate } from './types.js'

export const orderConfirmedTemplate: NotificationTemplate = {
  flowType: 'order_confirmed',
  title: '{{store_name}} - Pedido confirmado!',
  body: 'Seu pedido #{{order_number}} foi confirmado! Acompanhe o status pelo app.',
  variables: ['store_name', 'order_number', 'order_total', 'estimated_delivery'],
}
