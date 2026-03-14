import { appUserProducts } from '@appfy/db'
import { and, eq } from 'drizzle-orm'
import { BaseRepository } from '../repositories/base.repository.js'

/**
 * Repository for app_user_products LGPD operations.
 * Only exposes methods needed for LGPD data deletion.
 */
export class ProductRepository extends BaseRepository {
  /**
   * Delete all product interactions for a specific app user (LGPD data deletion).
   * @returns number of deleted rows
   */
  async deleteByAppUser(tenantId: string, appUserId: string): Promise<number> {
    this.assertTenantId(tenantId)
    const deleted = await this.db
      .delete(appUserProducts)
      .where(and(eq(appUserProducts.tenantId, tenantId), eq(appUserProducts.appUserId, appUserId)))
      .returning()
    return deleted.length
  }
}
