import type { NotificationTemplate } from './types.js'

export const boletoRecoveryTemplate: NotificationTemplate = {
  flowType: 'boleto_recovery',
  title: '{{store_name}} - Seu boleto está vencendo!',
  body: 'O boleto do pedido #{{order_number}} vence em breve. Pague agora e garanta sua compra!',
  variables: ['store_name', 'order_number', 'order_total', 'boleto_url', 'due_date'],
}
