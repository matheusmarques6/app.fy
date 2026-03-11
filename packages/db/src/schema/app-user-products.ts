import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { appUsers } from './app-users.js'
import { tenants } from './tenants.js'

export const interactionTypeEnum = pgEnum('interaction_type', ['viewed', 'favorited', 'purchased'])

export const appUserProducts = pgTable('app_user_products', {
  id: uuid().primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  appUserId: uuid('app_user_id')
    .notNull()
    .references(() => appUsers.id),
  productIdExternal: text('product_id_external').notNull(),
  productName: text('product_name').notNull(),
  productImageUrl: text('product_image_url'),
  interactionType: interactionTypeEnum('interaction_type').notNull(),
  lastInteractionAt: timestamp('last_interaction_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
