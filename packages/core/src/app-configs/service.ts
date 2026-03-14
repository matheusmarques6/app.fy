import type { AppConfigRepository, AppConfigRow, UpdateAppConfigInput } from './repository.js'

export class AppConfigService {
  constructor(private readonly appConfigRepo: AppConfigRepository) {}

  async getConfig(tenantId: string): Promise<AppConfigRow | undefined> {
    return this.appConfigRepo.findByTenantId(tenantId)
  }

  async updateConfig(tenantId: string, input: UpdateAppConfigInput): Promise<AppConfigRow> {
    return this.appConfigRepo.upsert(tenantId, input)
  }
}
