import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { appUsers } from './app-users.js'
import { tenants } from './tenants.js'

export const appUserSegments = pgTable('app_user_segments', {
  id: uuid().primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  appUserId: uuid('app_user_id')
    .notNull()
    .references(() => appUsers.id),
  segmentName: text('segment_name').notNull(),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
})
