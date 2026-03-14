import { automationConfigs } from '@appfy/db'
import type { FlowType } from '@appfy/shared'
import { and, asc, eq } from 'drizzle-orm'
import { BaseRepository } from '../repositories/base.repository.js'

export interface AutomationConfigRow {
  readonly id: string
  readonly tenantId: string
  readonly flowType: FlowType
  readonly isEnabled: boolean
  readonly delaySeconds: number
  readonly templateTitle: string
  readonly templateBody: string
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface UpdateAutomationInput {
  readonly delaySeconds?: number
  readonly templateTitle?: string
  readonly templateBody?: string
}

export class AutomationRepository extends BaseRepository {
  async findByFlow(
    tenantId: string,
    flowType: FlowType,
  ): Promise<AutomationConfigRow | undefined> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select()
      .from(automationConfigs)
      .where(and(eq(automationConfigs.tenantId, tenantId), eq(automationConfigs.flowType, flowType)))
      .limit(1)
    return rows[0] as AutomationConfigRow | undefined
  }

  async listByTenant(tenantId: string): Promise<AutomationConfigRow[]> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select()
      .from(automationConfigs)
      .where(eq(automationConfigs.tenantId, tenantId))
      .orderBy(asc(automationConfigs.flowType))
    return rows as AutomationConfigRow[]
  }

  async update(
    tenantId: string,
    flowType: FlowType,
    input: UpdateAutomationInput,
  ): Promise<AutomationConfigRow> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .update(automationConfigs)
      .set({
        ...(input.delaySeconds !== undefined && { delaySeconds: input.delaySeconds }),
        ...(input.templateTitle !== undefined && { templateTitle: input.templateTitle }),
        ...(input.templateBody !== undefined && { templateBody: input.templateBody }),
        updatedAt: new Date(),
      })
      .where(
        and(eq(automationConfigs.tenantId, tenantId), eq(automationConfigs.flowType, flowType)),
      )
      .returning()
    return rows[0] as AutomationConfigRow
  }

  async toggleEnabled(tenantId: string, flowType: FlowType, enabled: boolean): Promise<void> {
    this.assertTenantId(tenantId)
    await this.db
      .update(automationConfigs)
      .set({ isEnabled: enabled, updatedAt: new Date() })
      .where(
        and(eq(automationConfigs.tenantId, tenantId), eq(automationConfigs.flowType, flowType)),
      )
  }

  async disableAllForTenant(tenantId: string): Promise<void> {
    this.assertTenantId(tenantId)
    await this.db
      .update(automationConfigs)
      .set({ isEnabled: false, updatedAt: new Date() })
      .where(eq(automationConfigs.tenantId, tenantId))
  }
}
