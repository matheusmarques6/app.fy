import type { FlowType } from '@appfy/shared'
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
    _flowType: FlowType,
  ): Promise<AutomationConfigRow | undefined> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async listByTenant(tenantId: string): Promise<AutomationConfigRow[]> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async update(
    tenantId: string,
    _flowType: FlowType,
    _input: UpdateAutomationInput,
  ): Promise<AutomationConfigRow> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }

  async toggleEnabled(tenantId: string, _flowType: FlowType, _enabled: boolean): Promise<void> {
    this.assertTenantId(tenantId)
    throw new Error('Not implemented')
  }
}
