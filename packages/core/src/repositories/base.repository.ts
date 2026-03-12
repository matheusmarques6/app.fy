import type { Database } from '@appfy/db'
import { MissingTenantIdError } from '../errors.js'

/**
 * Base repository that enforces tenantId in every operation.
 * All domain repositories MUST extend this class.
 *
 * The tenantId parameter is mandatory on every method to ensure
 * RLS-like isolation at the application layer (defense-in-depth).
 */
export abstract class BaseRepository {
  constructor(protected readonly db: Database) {}

  /**
   * Validates tenantId is present and non-empty.
   * Called internally before every DB operation.
   * @throws {MissingTenantIdError} if tenantId is missing or empty
   */
  protected assertTenantId(tenantId: string): void {
    if (!tenantId || tenantId.trim() === '') {
      throw new MissingTenantIdError()
    }
  }
}
