import type { NotificationTemplate } from './types.js'

export const pixRecoveryTemplate: NotificationTemplate = {
  flowType: 'pix_recovery',
  title: '{{store_name}} - Seu Pix está pendente!',
  body: 'O pagamento via Pix do pedido #{{order_number}} ainda não foi confirmado. Pague agora!',
  variables: ['store_name', 'order_number', 'order_total', 'pix_code', 'payment_url'],
}
