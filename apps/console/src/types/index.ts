// Re-exports from @appfy/shared
export type {
  FlowType,
  PlanName,
  PlanConfig,
  MembershipRole,
  RolePermission,
  NotificationStatus,
  NotificationType,
  DeliveryStatus,
  BuildStatus,
  Platform,
  DevicePlatform,
  AppEventType,
  JwtPayload,
  Tenant,
  TenantMembership,
  PaginatedResponse,
  PaginationParams,
  ApiResponse,
  ApiErrorResponse,
} from '@appfy/shared'

// UI-specific types

export interface NavItem {
  label: string
  href: string
  icon: string
}

export interface MetricCard {
  label: string
  value: string
  change: number
  changeLabel: string
}

export interface ChartDataPoint {
  date: string
  value: number
}

export interface NotificationRow {
  id: string
  title: string
  type: 'manual' | 'automated'
  flowType: string | null
  status: string
  sentCount: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  convertedCount: number
  revenue: number
  createdAt: string
}

export interface AutomationFlow {
  id: string
  flowType: string
  title: string
  description: string
  isEnabled: boolean
  delaySeconds: number
  templateTitle: string
  templateBody: string
  sentCount: number
  conversionRate: number
}

export interface CustomerRow {
  id: string
  name: string
  email: string
  platform: string
  pushOptIn: boolean
  totalSpent: number
  purchaseCount: number
  lastSeen: string
  createdAt: string
}

export interface IntegrationInfo {
  id: string
  name: string
  platform: string
  status: 'connected' | 'disconnected' | 'error'
  lastSync: string | null
  icon: string
}

export interface InvoiceRow {
  id: string
  date: string
  amount: number
  status: 'paid' | 'pending' | 'failed'
  downloadUrl: string
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'owner' | 'editor' | 'viewer'
  joinedAt: string
  avatarUrl: string | null
}

export interface AuditEntry {
  id: string
  action: string
  resource: string
  userId: string
  userName: string
  createdAt: string
}

export interface SessionInfo {
  id: string
  device: string
  browser: string
  ip: string
  lastActive: string
  isCurrent: boolean
}
