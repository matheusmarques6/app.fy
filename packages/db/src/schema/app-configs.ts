import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tenants } from './tenants.js'

export const buildStatusEnum = pgEnum('build_status', ['pending', 'building', 'ready', 'published'])

export const appConfigs = pgTable('app_configs', {
  id: uuid().primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .unique()
    .references(() => tenants.id),
  appName: text('app_name'),
  iconUrl: text('icon_url'),
  splashUrl: text('splash_url'),
  primaryColor: text('primary_color'),
  secondaryColor: text('secondary_color'),
  menuItems: jsonb('menu_items'),
  storeUrl: text('store_url'),
  androidPackageName: text('android_package_name'),
  iosBundleId: text('ios_bundle_id'),
  buildStatus: buildStatusEnum('build_status'),
  lastBuildAt: timestamp('last_build_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
