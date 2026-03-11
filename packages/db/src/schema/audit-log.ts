import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tenants } from './tenants.js'
import { users } from './users.js'

export const auditLog = pgTable('audit_log', {
  id: uuid().primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  userId: uuid('user_id').references(() => users.id),
  action: text().notNull(),
  resource: text().notNull(),
  details: jsonb(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
