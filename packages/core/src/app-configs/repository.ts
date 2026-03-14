import { appConfigs } from '@appfy/db'
import { eq } from 'drizzle-orm'
import { BaseRepository } from '../repositories/base.repository.js'
import type { BuildStatus } from '../builds/service.js'

export interface AppConfigRow {
  readonly id: string
  readonly tenantId: string
  readonly appName: string | null
  readonly iconUrl: string | null
  readonly splashUrl: string | null
  readonly primaryColor: string | null
  readonly secondaryColor: string | null
  readonly menuItems: unknown
  readonly storeUrl: string | null
  readonly androidPackageName: string | null
  readonly iosBundleId: string | null
  readonly buildStatus: string | null
  readonly lastBuildAt: Date | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface UpdateAppConfigInput {
  readonly appName?: string
  readonly iconUrl?: string
  readonly splashUrl?: string
  readonly primaryColor?: string
  readonly secondaryColor?: string
  readonly menuItems?: unknown
  readonly storeUrl?: string
  readonly androidPackageName?: string
  readonly iosBundleId?: string
}

export class AppConfigRepository extends BaseRepository {
  async findByTenantId(tenantId: string): Promise<AppConfigRow | undefined> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .select()
      .from(appConfigs)
      .where(eq(appConfigs.tenantId, tenantId))
      .limit(1)
    return rows[0] as AppConfigRow | undefined
  }

  async upsert(tenantId: string, input: UpdateAppConfigInput): Promise<AppConfigRow> {
    this.assertTenantId(tenantId)
    const rows = await this.db
      .insert(appConfigs)
      .values({ tenantId, ...input })
      .onConflictDoUpdate({
        target: appConfigs.tenantId,
        set: { ...input, updatedAt: new Date() },
      })
      .returning()
    return rows[0] as AppConfigRow
  }

  async updateBuildStatus(tenantId: string, status: BuildStatus): Promise<AppConfigRow> {
    this.assertTenantId(tenantId)
    const now = new Date()
    const rows = await this.db
      .update(appConfigs)
      .set({
        buildStatus: status,
        lastBuildAt: status === 'ready' || status === 'published' ? now : undefined,
        updatedAt: now,
      })
      .where(eq(appConfigs.tenantId, tenantId))
      .returning()
    if (!rows[0]) {
      throw new Error('App config not found')
    }
    return rows[0] as AppConfigRow
  }
}
