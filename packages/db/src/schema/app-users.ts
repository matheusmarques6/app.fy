import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { tenants } from './tenants.js'

export const appUsers = pgTable(
  'app_users',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userIdExternal: text('user_id_external'),
    email: text(),
    name: text(),
    pushOptIn: boolean('push_opt_in').default(true).notNull(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    totalPurchases: integer('total_purchases').default(0).notNull(),
    totalSpent: integer('total_spent').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('app_users_tenant_external_id_unique').on(table.tenantId, table.userIdExternal),
  ],
)
