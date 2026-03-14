import type { FlowType } from '../constants/flow-types.js'
import type {
  NotificationStatus,
  NotificationType,
} from '../constants/event-types.js'

/** Segment rule for targeting users */
export interface SegmentRule {
  readonly field: string
  readonly operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains'
  readonly value: unknown
}

/** Segment rules with logical grouping */
export interface SegmentRules {
  readonly logic: 'and' | 'or'
  readonly rules: readonly SegmentRule[]
}

/** A/B test variant */
export interface AbVariant {
  readonly variantId: string
  readonly title: string
  readonly body: string
  readonly splitPercent: number
}

/** Push notification entity */
export interface Notification {
  readonly id: string
  readonly tenantId: string
  readonly title: string
  readonly body: string
  readonly type: NotificationType
  readonly status: NotificationStatus
  readonly flowType: FlowType | null
  readonly segmentRules: SegmentRules | null
  readonly abVariants: readonly AbVariant[] | null
  readonly scheduledAt: Date | null
  readonly sentAt: Date | null
  readonly createdAt: Date
  readonly updatedAt: Date
}
