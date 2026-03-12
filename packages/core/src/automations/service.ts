import type { FlowType } from '@appfy/shared'
import { AutomationNotFoundError } from '../errors.js'
import type {
  AutomationConfigRow,
  AutomationRepository,
  UpdateAutomationInput,
} from './repository.js'

export class AutomationService {
  constructor(private readonly automationRepo: AutomationRepository) {}

  async getConfig(tenantId: string, flowType: FlowType): Promise<AutomationConfigRow> {
    const config = await this.automationRepo.findByFlow(tenantId, flowType)
    if (!config) {
      throw new AutomationNotFoundError(`${tenantId}:${flowType}`)
    }
    return config
  }

  async listConfigs(tenantId: string): Promise<AutomationConfigRow[]> {
    return this.automationRepo.listByTenant(tenantId)
  }

  async updateConfig(
    tenantId: string,
    flowType: FlowType,
    input: UpdateAutomationInput,
  ): Promise<AutomationConfigRow> {
    await this.getConfig(tenantId, flowType)
    return this.automationRepo.update(tenantId, flowType, input)
  }

  async toggleEnabled(tenantId: string, flowType: FlowType, enabled: boolean): Promise<void> {
    await this.getConfig(tenantId, flowType)
    return this.automationRepo.toggleEnabled(tenantId, flowType, enabled)
  }
}
