import type { AutomationConfigRow, UpdateAutomationInput } from '@appfy/core'
import type { FlowType } from '@appfy/shared'
import { AutomationConfigBuilder } from '../builders/automation-config.builder.js'
import { SpyBase } from './spy-base.js'

/** Mirrors {@link AutomationRepository} from @appfy/core (concrete class, not interface) */
export class AutomationConfigRepositorySpy extends SpyBase {
  result: AutomationConfigRow | undefined = undefined
  listResult: AutomationConfigRow[] = []

  async findByFlow(tenantId: string, flowType: FlowType): Promise<AutomationConfigRow | undefined> {
    this.trackCall('findByFlow', [tenantId, flowType])
    return this.result
  }

  async listByTenant(tenantId: string): Promise<AutomationConfigRow[]> {
    this.trackCall('listByTenant', [tenantId])
    return this.listResult
  }

  async update(
    tenantId: string,
    flowType: FlowType,
    input: UpdateAutomationInput,
  ): Promise<AutomationConfigRow> {
    this.trackCall('update', [tenantId, flowType, input])
    return (
      this.result ??
      new AutomationConfigBuilder().withTenant(tenantId).withFlowType(flowType).build()
    )
  }

  async toggleEnabled(tenantId: string, flowType: FlowType, enabled: boolean): Promise<void> {
    this.trackCall('toggleEnabled', [tenantId, flowType, enabled])
  }
}
