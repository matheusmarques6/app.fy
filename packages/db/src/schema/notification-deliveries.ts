import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { devices } from './devices.js'
import { notifications } from './notifications.js'
import { tenants } from './tenants.js'

export const deliveryStatusEnum = pgEnum('delivery_status', [
  'pending',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'converted',
  'failed',
])

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: uuid().primaryKey().defaultRandom(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    status: deliveryStatusEnum().notNull().default('pending'),
    errorMessage: text('error_message'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    clickedAt: timestamp('clicked_at', { withTimezone: true }),
    convertedAt: timestamp('converted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('notification_deliveries_tenant_status_created_idx').on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
  ],
)
