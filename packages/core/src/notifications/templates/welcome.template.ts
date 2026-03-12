import type { NotificationTemplate } from './types.js'

export const welcomeTemplate: NotificationTemplate = {
  flowType: 'welcome',
  title: 'Bem-vindo à {{store_name}}!',
  body: 'Obrigado por baixar nosso app. Explore nossos produtos e aproveite ofertas exclusivas!',
  variables: ['store_name', 'user_name'],
}
