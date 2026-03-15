import type {
  NotificationRow,
  AutomationFlow,
  CustomerRow,
  IntegrationInfo,
  InvoiceRow,
  TeamMember,
  AuditEntry,
  SessionInfo,
  ChartDataPoint,
} from '@/types'

// ─── Dashboard ─────────────────────────────────────────────

export const dashboardMetrics = {
  revenue: 4523000, // R$ 45.230,00 in cents
  revenueChange: 12.5,
  sent: 15420,
  sentChange: 8.3,
  openRate: 68.2,
  openRateChange: 2.1,
  clickRate: 24.7,
  clickRateChange: -1.3,
  conversionRate: 8.4,
  conversionRateChange: 3.2,
  activeAutomations: 7,
  totalAutomations: 9,
  appStatus: 'published' as const,
}

export const revenueChartData: ChartDataPoint[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (29 - i))
  return {
    date: date.toISOString().split('T')[0]!,
    value: Math.floor(800 + Math.random() * 2000),
  }
})

export const topNotifications: NotificationRow[] = [
  {
    id: 'n-1',
    title: 'Seu carrinho te espera! 10% OFF',
    type: 'automated',
    flowType: 'cart_abandoned',
    status: 'sent',
    sentCount: 3240,
    deliveredCount: 3102,
    openedCount: 2180,
    clickedCount: 890,
    convertedCount: 312,
    revenue: 1245000,
    createdAt: '2026-03-10T14:00:00Z',
  },
  {
    id: 'n-2',
    title: 'Seu PIX expira em 30 minutos!',
    type: 'automated',
    flowType: 'pix_recovery',
    status: 'sent',
    sentCount: 1850,
    deliveredCount: 1780,
    openedCount: 1420,
    clickedCount: 680,
    convertedCount: 245,
    revenue: 890000,
    createdAt: '2026-03-09T10:00:00Z',
  },
  {
    id: 'n-3',
    title: 'Mega promoção de verao - 30% OFF',
    type: 'manual',
    flowType: null,
    status: 'sent',
    sentCount: 8900,
    deliveredCount: 8450,
    openedCount: 5200,
    clickedCount: 1800,
    convertedCount: 420,
    revenue: 980000,
    createdAt: '2026-03-08T16:00:00Z',
  },
  {
    id: 'n-4',
    title: 'Bem-vindo ao nosso app!',
    type: 'automated',
    flowType: 'welcome',
    status: 'sent',
    sentCount: 2100,
    deliveredCount: 2050,
    openedCount: 1890,
    clickedCount: 920,
    convertedCount: 180,
    revenue: 450000,
    createdAt: '2026-03-07T08:00:00Z',
  },
  {
    id: 'n-5',
    title: 'Que tal experimentar algo novo?',
    type: 'automated',
    flowType: 'upsell',
    status: 'sent',
    sentCount: 1200,
    deliveredCount: 1150,
    openedCount: 780,
    clickedCount: 340,
    convertedCount: 95,
    revenue: 380000,
    createdAt: '2026-03-06T12:00:00Z',
  },
]

// ─── Notifications ─────────────────────────────────────────

export const notifications: NotificationRow[] = [
  ...topNotifications,
  {
    id: 'n-6',
    title: 'Seu boleto vence amanha!',
    type: 'automated',
    flowType: 'boleto_recovery',
    status: 'sent',
    sentCount: 920,
    deliveredCount: 880,
    openedCount: 650,
    clickedCount: 310,
    convertedCount: 85,
    revenue: 280000,
    createdAt: '2026-03-05T09:00:00Z',
  },
  {
    id: 'n-7',
    title: 'Novidades que voce vai amar',
    type: 'manual',
    flowType: null,
    status: 'draft',
    sentCount: 0,
    deliveredCount: 0,
    openedCount: 0,
    clickedCount: 0,
    convertedCount: 0,
    revenue: 0,
    createdAt: '2026-03-12T11:00:00Z',
  },
  {
    id: 'n-8',
    title: 'Pedido confirmado! Obrigado pela compra',
    type: 'automated',
    flowType: 'order_confirmed',
    status: 'sent',
    sentCount: 4500,
    deliveredCount: 4380,
    openedCount: 3900,
    clickedCount: 1200,
    convertedCount: 0,
    revenue: 0,
    createdAt: '2026-03-04T15:00:00Z',
  },
  {
    id: 'n-9',
    title: 'Seu pedido saiu para entrega!',
    type: 'automated',
    flowType: 'tracking_created',
    status: 'sent',
    sentCount: 3800,
    deliveredCount: 3700,
    openedCount: 3500,
    clickedCount: 2100,
    convertedCount: 0,
    revenue: 0,
    createdAt: '2026-03-03T14:00:00Z',
  },
  {
    id: 'n-10',
    title: 'Voce esqueceu de finalizar a compra',
    type: 'automated',
    flowType: 'checkout_abandoned',
    status: 'sent',
    sentCount: 1600,
    deliveredCount: 1520,
    openedCount: 1050,
    clickedCount: 480,
    convertedCount: 155,
    revenue: 520000,
    createdAt: '2026-03-02T10:00:00Z',
  },
]

// ─── Automations ───────────────────────────────────────────

export const automationFlows: AutomationFlow[] = [
  {
    id: 'af-1',
    flowType: 'cart_abandoned',
    title: 'Carrinho Abandonado',
    description: 'Recupere vendas de carrinhos abandonados com push automatico',
    isEnabled: true,
    delaySeconds: 3600,
    templateTitle: 'Esqueceu algo no carrinho? {{product_name}}',
    templateBody: 'Seu carrinho com {{product_name}} esta te esperando! Finalize sua compra agora.',
    sentCount: 3240,
    conversionRate: 9.6,
  },
  {
    id: 'af-2',
    flowType: 'pix_recovery',
    title: 'Recuperacao PIX',
    description: 'Lembre clientes sobre pagamentos PIX pendentes',
    isEnabled: true,
    delaySeconds: 1800,
    templateTitle: 'Seu PIX expira em breve!',
    templateBody:
      'O pagamento PIX do pedido #{{order_id}} expira em breve. Pague agora para garantir!',
    sentCount: 1850,
    conversionRate: 13.2,
  },
  {
    id: 'af-3',
    flowType: 'boleto_recovery',
    title: 'Recuperacao Boleto',
    description: 'Notifique sobre boletos proximos do vencimento',
    isEnabled: true,
    delaySeconds: 3600,
    templateTitle: 'Seu boleto vence amanha!',
    templateBody: 'Nao esqueca de pagar seu boleto de R$ {{order_total}} antes do vencimento.',
    sentCount: 920,
    conversionRate: 9.2,
  },
  {
    id: 'af-4',
    flowType: 'welcome',
    title: 'Boas-vindas',
    description: 'Primeira impressao conta! Receba novos usuarios no app',
    isEnabled: true,
    delaySeconds: 300,
    templateTitle: 'Bem-vindo ao {{store_name}}!',
    templateBody: 'Que bom ter voce aqui! Explore nossos produtos e aproveite ofertas exclusivas.',
    sentCount: 2100,
    conversionRate: 8.6,
  },
  {
    id: 'af-5',
    flowType: 'checkout_abandoned',
    title: 'Checkout Abandonado',
    description: 'Recupere vendas de checkouts nao finalizados',
    isEnabled: true,
    delaySeconds: 3600,
    templateTitle: 'Falta pouco! Finalize sua compra',
    templateBody: 'Voce estava quase la! Finalize a compra de {{product_name}} agora.',
    sentCount: 1600,
    conversionRate: 9.7,
  },
  {
    id: 'af-6',
    flowType: 'order_confirmed',
    title: 'Pedido Confirmado',
    description: 'Confirme pedidos pagos instantaneamente',
    isEnabled: true,
    delaySeconds: 0,
    templateTitle: 'Pedido confirmado!',
    templateBody: 'Seu pedido #{{order_id}} foi confirmado! Acompanhe o status pelo app.',
    sentCount: 4500,
    conversionRate: 0,
  },
  {
    id: 'af-7',
    flowType: 'tracking_created',
    title: 'Rastreio Criado',
    description: 'Avise sobre envio e rastreio do pedido',
    isEnabled: true,
    delaySeconds: 0,
    templateTitle: 'Seu pedido saiu para entrega!',
    templateBody: 'O pedido #{{order_id}} esta a caminho! Acompanhe pelo app.',
    sentCount: 3800,
    conversionRate: 0,
  },
  {
    id: 'af-8',
    flowType: 'browse_abandoned',
    title: 'Navegacao Abandonada',
    description: 'Reengaje usuarios que viram produtos sem comprar',
    isEnabled: false,
    delaySeconds: 7200,
    templateTitle: 'Gostou de {{product_name}}?',
    templateBody: 'Voce viu {{product_name}} recentemente. Que tal dar uma segunda olhada?',
    sentCount: 0,
    conversionRate: 0,
  },
  {
    id: 'af-9',
    flowType: 'upsell',
    title: 'Upsell Pos-Compra',
    description: 'Sugira produtos complementares apos a entrega',
    isEnabled: false,
    delaySeconds: 259200,
    templateTitle: 'Que tal experimentar algo novo?',
    templateBody: 'Com base na sua ultima compra, achamos que voce vai gostar de {{product_name}}!',
    sentCount: 1200,
    conversionRate: 7.9,
  },
]

// ─── Analytics ─────────────────────────────────────────────

export const analyticsFunnel = [
  { stage: 'Enviados', value: 15420, percentage: 100 },
  { stage: 'Entregues', value: 14890, percentage: 96.6 },
  { stage: 'Abertos', value: 10200, percentage: 66.1 },
  { stage: 'Clicados', value: 3820, percentage: 24.8 },
  { stage: 'Convertidos', value: 1292, percentage: 8.4 },
]

export const revenueByFlow = [
  { flow: 'Carrinho Abandonado', revenue: 1245000 },
  { flow: 'PIX Recovery', revenue: 890000 },
  { flow: 'Manual', revenue: 980000 },
  { flow: 'Boas-vindas', revenue: 450000 },
  { flow: 'Checkout Abandonado', revenue: 520000 },
  { flow: 'Boleto Recovery', revenue: 280000 },
  { flow: 'Upsell', revenue: 380000 },
]

export const engagementHeatmap = Array.from({ length: 7 }, (_, dayIndex) =>
  Array.from({ length: 24 }, (_, hour) => ({
    day: dayIndex,
    hour,
    value: Math.floor(Math.random() * 100),
  })),
).flat()

export const platformDistribution = [
  { platform: 'Android', count: 8920, percentage: 62.4 },
  { platform: 'iOS', count: 5380, percentage: 37.6 },
]

export const activeUsersData: ChartDataPoint[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (29 - i))
  return {
    date: date.toISOString().split('T')[0]!,
    value: Math.floor(1200 + Math.random() * 800),
  }
})

export const analyticsKpis = {
  optInRate: 74.2,
  retentionD7: 62.5,
  retentionD30: 41.8,
  avgSessionDuration: 185,
  pushFrequency: 2.3,
}

// ─── App Config ────────────────────────────────────────────

export const appConfig = {
  appName: 'Minha Loja App',
  packageName: 'com.minhaloja.app',
  primaryColor: '#A855F7',
  secondaryColor: '#1E1E2E',
  iconUrl: null as string | null,
  splashUrl: null as string | null,
  buildStatus: 'published' as const,
  lastBuildAt: '2026-03-10T18:00:00Z',
  currentVersion: '1.2.0',
  buildHistory: [
    {
      id: 'b-1',
      version: '1.2.0',
      status: 'published',
      createdAt: '2026-03-10T18:00:00Z',
      platform: 'android',
    },
    {
      id: 'b-2',
      version: '1.2.0',
      status: 'published',
      createdAt: '2026-03-10T17:30:00Z',
      platform: 'ios',
    },
    {
      id: 'b-3',
      version: '1.1.0',
      status: 'published',
      createdAt: '2026-02-28T14:00:00Z',
      platform: 'android',
    },
    {
      id: 'b-4',
      version: '1.1.0',
      status: 'published',
      createdAt: '2026-02-28T13:30:00Z',
      platform: 'ios',
    },
    {
      id: 'b-5',
      version: '1.0.0',
      status: 'published',
      createdAt: '2026-02-15T10:00:00Z',
      platform: 'android',
    },
  ],
  menuItems: [
    { id: 'm-1', label: 'Inicio', icon: 'home', url: '/' },
    { id: 'm-2', label: 'Categorias', icon: 'grid', url: '/categories' },
    { id: 'm-3', label: 'Ofertas', icon: 'tag', url: '/offers' },
    { id: 'm-4', label: 'Minha Conta', icon: 'user', url: '/account' },
  ],
}

// ─── Integrations ──────────────────────────────────────────

export const integrations: IntegrationInfo[] = [
  {
    id: 'int-1',
    name: 'Shopify',
    platform: 'shopify',
    status: 'connected',
    lastSync: '2026-03-13T08:30:00Z',
    icon: 'shopping-bag',
  },
  {
    id: 'int-2',
    name: 'Nuvemshop',
    platform: 'nuvemshop',
    status: 'disconnected',
    lastSync: null,
    icon: 'cloud',
  },
  {
    id: 'int-3',
    name: 'Klaviyo',
    platform: 'klaviyo',
    status: 'connected',
    lastSync: '2026-03-13T07:00:00Z',
    icon: 'mail',
  },
  {
    id: 'int-4',
    name: 'OneSignal',
    platform: 'onesignal',
    status: 'connected',
    lastSync: '2026-03-13T09:00:00Z',
    icon: 'bell',
  },
  {
    id: 'int-5',
    name: 'Stripe',
    platform: 'stripe',
    status: 'connected',
    lastSync: '2026-03-13T06:00:00Z',
    icon: 'credit-card',
  },
]

// ─── Customers ─────────────────────────────────────────────

export const customers: CustomerRow[] = Array.from({ length: 20 }, (_, i) => ({
  id: `cu-${i + 1}`,
  name: [
    'Maria Silva',
    'Joao Santos',
    'Ana Oliveira',
    'Carlos Souza',
    'Fernanda Lima',
    'Pedro Costa',
    'Juliana Almeida',
    'Rafael Pereira',
    'Camila Rodrigues',
    'Lucas Ferreira',
    'Beatriz Carvalho',
    'Gustavo Martins',
    'Larissa Araujo',
    'Thiago Ribeiro',
    'Isabela Gomes',
    'Mateus Barbosa',
    'Carolina Nascimento',
    'Bruno Rocha',
    'Amanda Cardoso',
    'Diego Mendes',
  ][i]!,
  email: `usuario${i + 1}@email.com`,
  platform: i % 3 === 0 ? 'ios' : 'android',
  pushOptIn: i % 5 !== 0,
  totalSpent: Math.floor(Math.random() * 500000) + 5000,
  purchaseCount: Math.floor(Math.random() * 20) + 1,
  lastSeen: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
  createdAt: new Date(Date.now() - Math.random() * 90 * 86400000).toISOString(),
}))

export const segments = [
  {
    id: 'seg-1',
    name: 'Alto Valor',
    description: 'Clientes com gasto total acima de R$ 500',
    rules: { operator: 'AND', conditions: [{ field: 'total_spent', op: 'gte', value: 50000 }] },
    memberCount: 342,
  },
  {
    id: 'seg-2',
    name: 'Inativos 30d',
    description: 'Clientes sem atividade nos ultimos 30 dias',
    rules: { operator: 'AND', conditions: [{ field: 'last_seen', op: 'lt', value: '30d' }] },
    memberCount: 1205,
  },
  {
    id: 'seg-3',
    name: 'Compradores Recentes',
    description: 'Clientes com compra nos ultimos 7 dias',
    rules: { operator: 'AND', conditions: [{ field: 'last_purchase', op: 'gte', value: '7d' }] },
    memberCount: 89,
  },
  {
    id: 'seg-4',
    name: 'Opt-in Push',
    description: 'Clientes com push habilitado',
    rules: { operator: 'AND', conditions: [{ field: 'push_opt_in', op: 'eq', value: true }] },
    memberCount: 4820,
  },
]

// ─── Billing ───────────────────────────────────────────────

export const billingData = {
  currentPlan: 'business' as 'starter' | 'business' | 'elite',
  notificationsSent: 8,
  notificationLimit: null as number | null,
  nextBillingDate: '2026-04-10',
  nextBillingAmount: 19700,
  stripeCustomerId: 'cus_mock_123',
}

export const invoices: InvoiceRow[] = [
  { id: 'inv-1', date: '2026-03-10', amount: 19700, status: 'paid', downloadUrl: '#' },
  { id: 'inv-2', date: '2026-02-10', amount: 19700, status: 'paid', downloadUrl: '#' },
  { id: 'inv-3', date: '2026-01-10', amount: 12700, status: 'paid', downloadUrl: '#' },
  { id: 'inv-4', date: '2025-12-10', amount: 12700, status: 'paid', downloadUrl: '#' },
]

// ─── Settings ──────────────────────────────────────────────

export const teamMembers: TeamMember[] = [
  {
    id: 'tm-1',
    name: 'Matheus Admin',
    email: 'matheus@appfy.com',
    role: 'owner',
    joinedAt: '2025-12-01T00:00:00Z',
    avatarUrl: null,
  },
  {
    id: 'tm-2',
    name: 'Ana Editor',
    email: 'ana@appfy.com',
    role: 'editor',
    joinedAt: '2026-01-15T00:00:00Z',
    avatarUrl: null,
  },
  {
    id: 'tm-3',
    name: 'Carlos Viewer',
    email: 'carlos@appfy.com',
    role: 'viewer',
    joinedAt: '2026-02-20T00:00:00Z',
    avatarUrl: null,
  },
]

export const auditLog: AuditEntry[] = [
  {
    id: 'al-1',
    action: 'notification.created',
    resource: 'Mega promoção de verão',
    userId: 'tm-1',
    userName: 'Matheus Admin',
    createdAt: '2026-03-12T15:30:00Z',
  },
  {
    id: 'al-2',
    action: 'automation.toggled',
    resource: 'Browse Abandoned → OFF',
    userId: 'tm-2',
    userName: 'Ana Editor',
    createdAt: '2026-03-12T14:00:00Z',
  },
  {
    id: 'al-3',
    action: 'member.invited',
    resource: 'carlos@appfy.com (viewer)',
    userId: 'tm-1',
    userName: 'Matheus Admin',
    createdAt: '2026-03-11T10:00:00Z',
  },
  {
    id: 'al-4',
    action: 'billing.upgraded',
    resource: 'Starter → Business',
    userId: 'tm-1',
    userName: 'Matheus Admin',
    createdAt: '2026-03-10T09:00:00Z',
  },
  {
    id: 'al-5',
    action: 'app.build.triggered',
    resource: 'v1.2.0 Android + iOS',
    userId: 'tm-1',
    userName: 'Matheus Admin',
    createdAt: '2026-03-10T08:00:00Z',
  },
]

export const activeSessions: SessionInfo[] = [
  {
    id: 'sess-1',
    device: 'Windows 11',
    browser: 'Chrome 122',
    ip: '187.12.34.56',
    lastActive: '2026-03-13T09:00:00Z',
    isCurrent: true,
  },
  {
    id: 'sess-2',
    device: 'iPhone 15',
    browser: 'Safari 17',
    ip: '187.12.34.57',
    lastActive: '2026-03-12T22:00:00Z',
    isCurrent: false,
  },
]

// ─── Tenants (mock multi-tenant) ───────────────────────────

export const mockTenants = [
  { id: 'tenant-1', name: 'Minha Loja', slug: 'minha-loja' },
  { id: 'tenant-2', name: 'Store Premium', slug: 'store-premium' },
]

// ─── Flow Labels/Icons ─────────────────────────────────────

export const flowTypeLabels: Record<string, string> = {
  cart_abandoned: 'Carrinho Abandonado',
  pix_recovery: 'Recuperacao PIX',
  boleto_recovery: 'Recuperacao Boleto',
  welcome: 'Boas-vindas',
  checkout_abandoned: 'Checkout Abandonado',
  order_confirmed: 'Pedido Confirmado',
  tracking_created: 'Rastreio Criado',
  browse_abandoned: 'Navegacao Abandonada',
  upsell: 'Upsell Pos-Compra',
}

export const flowTypeIcons: Record<string, string> = {
  cart_abandoned: 'ShoppingCart',
  pix_recovery: 'QrCode',
  boleto_recovery: 'FileText',
  welcome: 'PartyPopper',
  checkout_abandoned: 'CreditCard',
  order_confirmed: 'CheckCircle',
  tracking_created: 'Truck',
  browse_abandoned: 'Eye',
  upsell: 'TrendingUp',
}

// ─── Notification Statuses ─────────────────────────────────

export const notificationStatusLabels: Record<string, string> = {
  draft: 'Rascunho',
  approved: 'Aprovado',
  scheduled: 'Agendado',
  sending: 'Enviando',
  sent: 'Enviado',
  failed: 'Falhou',
}

export const notificationStatusColors: Record<string, string> = {
  draft: 'secondary',
  approved: 'violet',
  scheduled: 'warning',
  sending: 'violet',
  sent: 'success',
  failed: 'destructive',
}
