import { pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { appUsers } from './app-users.js'
import { segments } from './segments.js'
import { tenants } from './tenants.js'

export const appUserSegments = pgTable(
  'app_user_segments',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    segmentId: uuid('segment_id')
      .notNull()
      .references(() => segments.id),
    appUserId: uuid('app_user_id')
      .notNull()
      .references(() => appUsers.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    unique('app_user_segments_tenant_segment_user_unique').on(
      table.tenantId,
      table.segmentId,
      table.appUserId,
    ),
  ],
)
