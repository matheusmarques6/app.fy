import { boolean, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { tenants } from './tenants.js'

export const automationConfigs = pgTable(
  'automation_configs',
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    flowType: text('flow_type').notNull(),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    delaySeconds: integer('delay_seconds').notNull(),
    templateTitle: text('template_title').notNull(),
    templateBody: text('template_body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('automation_configs_tenant_flow_unique').on(table.tenantId, table.flowType)],
)
