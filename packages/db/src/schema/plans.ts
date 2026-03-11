import { integer, jsonb, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core'

export const planNameEnum = pgEnum('plan_name', ['starter', 'business', 'elite'])

export const plans = pgTable('plans', {
  id: uuid().primaryKey().defaultRandom(),
  name: planNameEnum().notNull(),
  notificationLimit: integer('notification_limit'),
  priceMonthly: integer('price_monthly').notNull(),
  priceYearly: integer('price_yearly').notNull(),
  features: jsonb(),
  stripePriceId: text('stripe_price_id'),
})
