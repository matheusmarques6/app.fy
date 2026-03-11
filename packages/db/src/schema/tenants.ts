import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { plans } from './plans.js'

export const platformEnum = pgEnum('platform', ['shopify', 'nuvemshop'])

export const tenants = pgTable('tenants', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  slug: text().unique().notNull(),
  platform: platformEnum(),
  platformStoreUrl: text('platform_store_url'),
  platformCredentials: jsonb('platform_credentials'),
  klaviyoCredentials: jsonb('klaviyo_credentials'),
  onesignalAppId: text('onesignal_app_id'),
  onesignalApiKeyEncrypted: jsonb('onesignal_api_key_encrypted'),
  planId: uuid('plan_id').references(() => plans.id),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  notificationCountCurrentPeriod: integer('notification_count_current_period').default(0).notNull(),
  notificationLimit: integer('notification_limit'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
