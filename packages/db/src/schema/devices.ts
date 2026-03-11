import { boolean, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { appUsers } from './app-users.js'
import { tenants } from './tenants.js'

export const devicePlatformEnum = pgEnum('device_platform', ['android', 'ios'])

export const devices = pgTable('devices', {
  id: uuid().primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  appUserId: uuid('app_user_id')
    .notNull()
    .references(() => appUsers.id),
  deviceToken: text('device_token'),
  platform: devicePlatformEnum().notNull(),
  osVersion: text('os_version'),
  appVersion: text('app_version'),
  isActive: boolean('is_active').default(true).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
