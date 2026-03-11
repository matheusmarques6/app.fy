import { index, jsonb, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'
import { appUsers } from './app-users.js'
import { devices } from './devices.js'
import { tenants } from './tenants.js'

export const eventTypeEnum = pgEnum('event_type', [
  'app_opened',
  'product_viewed',
  'add_to_cart',
  'purchase_completed',
  'push_opened',
  'push_clicked',
])

export const appEvents = pgTable(
  'app_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    appUserId: uuid('app_user_id').references(() => appUsers.id),
    deviceId: uuid('device_id').references(() => devices.id),
    eventType: eventTypeEnum('event_type').notNull(),
    properties: jsonb(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('app_events_tenant_event_created_idx').on(
      table.tenantId,
      table.eventType,
      table.createdAt,
    ),
  ],
)
