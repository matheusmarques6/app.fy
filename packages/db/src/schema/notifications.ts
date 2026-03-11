import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tenants } from './tenants.js'
import { users } from './users.js'

export const notificationTypeEnum = pgEnum('notification_type', ['manual', 'automated'])

export const flowTypeEnum = pgEnum('flow_type', [
  'cart_abandoned',
  'pix_recovery',
  'boleto_recovery',
  'welcome',
  'checkout_abandoned',
  'order_confirmed',
  'tracking_created',
  'browse_abandoned',
  'upsell',
])

export const notificationStatusEnum = pgEnum('notification_status', [
  'draft',
  'approved',
  'scheduled',
  'sending',
  'sent',
  'failed',
])

export const abVariantEnum = pgEnum('ab_variant', ['a', 'b'])

export const notifications = pgTable('notifications', {
  id: uuid().primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  type: notificationTypeEnum().notNull(),
  flowType: flowTypeEnum('flow_type'),
  title: text().notNull(),
  body: text().notNull(),
  imageUrl: text('image_url'),
  targetUrl: text('target_url'),
  segmentRules: jsonb('segment_rules'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id),
  abVariant: abVariantEnum('ab_variant'),
  status: notificationStatusEnum().notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
