import { AppUserNotFoundError } from '../errors.js'
import type { AuditLogger } from '../notifications/service.js'

/** Repository interface for app user operations needed by LGPD */
export interface LGPDAppUserRepository {
  findById(tenantId: string, id: string): Promise<{ id: string; tenantId: string } | undefined>
  updatePushOptIn(tenantId: string, id: string, optIn: boolean): Promise<void>
  delete(tenantId: string, id: string): Promise<void>
}

/** Repository interface for deleting events by app user */
export interface LGPDEventRepository {
  deleteByAppUser(tenantId: string, appUserId: string): Promise<number>
}

/** Repository interface for removing user from all segments */
export interface LGPDSegmentRepository {
  removeMemberFromAll(tenantId: string, appUserId: string): Promise<number>
}

/** Repository interface for deleting user products */
export interface LGPDProductRepository {
  deleteByAppUser(tenantId: string, appUserId: string): Promise<number>
}

/** Repository interface for deleting user devices */
export interface LGPDDeviceRepository {
  deleteByAppUser(tenantId: string, appUserId: string): Promise<number>
}

/** Repository interface for anonymizing deliveries */
export interface LGPDDeliveryRepository {
  anonymizeByAppUser(tenantId: string, appUserId: string): Promise<number>
}

/** All LGPD repos grouped — used to create transaction-scoped instances */
export interface LGPDRepos {
  appUserRepo: LGPDAppUserRepository
  eventRepo: LGPDEventRepository
  segmentRepo: LGPDSegmentRepository
  productRepo: LGPDProductRepository
  deviceRepo: LGPDDeviceRepository
  deliveryRepo: LGPDDeliveryRepository
  auditLog: AuditLogger
}

/**
 * Factory that creates a set of repos bound to a Drizzle transaction.
 * In production, this creates new repo instances with `tx` instead of `db`.
 */
export interface LGPDRepoFactory {
  createTransactional(tx: unknown): LGPDRepos
}

export interface LGPDServiceDeps {
  appUserRepo: LGPDAppUserRepository
  auditLog: AuditLogger
  repoFactory: LGPDRepoFactory
  runTransaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>
}

export interface UserDataDeletionResult {
  readonly eventsDeleted: number
  readonly segmentsRemoved: number
  readonly productsDeleted: number
  readonly devicesDeleted: number
  readonly deliveriesAnonymized: number
}

/**
 * LGPD Compliance Service.
 *
 * Handles:
 * - Push opt-in/opt-out with audit logging
 * - Complete user data deletion (LGPD right to be forgotten)
 *   - Anonymizes deliveries (preserves metrics) instead of deleting
 */
export class LGPDService {
  private readonly appUserRepo: LGPDAppUserRepository
  private readonly auditLog: AuditLogger
  private readonly repoFactory: LGPDRepoFactory
  private readonly runTransaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>

  constructor(deps: LGPDServiceDeps) {
    this.appUserRepo = deps.appUserRepo
    this.auditLog = deps.auditLog
    this.repoFactory = deps.repoFactory
    this.runTransaction = deps.runTransaction
  }

  /**
   * Updates push opt-in/opt-out for an app user.
   * Logs the change to audit trail (LGPD compliance).
   *
   * @throws {AppUserNotFoundError} if user does not exist
   */
  async updatePushOptIn(tenantId: string, appUserId: string, optIn: boolean): Promise<void> {
    const user = await this.appUserRepo.findById(tenantId, appUserId)
    if (!user) {
      throw new AppUserNotFoundError(appUserId)
    }

    await this.appUserRepo.updatePushOptIn(tenantId, appUserId, optIn)

    const action = optIn ? 'lgpd.push_opt_in' : 'lgpd.push_opt_out'
    await this.auditLog.log(tenantId, action, 'app_user', appUserId, { optIn })
  }

  /**
   * Deletes all user data (LGPD right to be forgotten).
   *
   * Executed in a single transaction — all repos are bound to the same `tx`:
   * 1. Delete app_events
   * 2. Remove from all segments
   * 3. Delete app_user_products
   * 4. Delete devices
   * 5. Anonymize notification_deliveries (set app_user_id = null, preserve metrics)
   * 6. Delete the app_user record
   * 7. Log to audit with deliveriesAnonymized flag
   *
   * @throws {AppUserNotFoundError} if user does not exist
   */
  async deleteUserData(tenantId: string, appUserId: string): Promise<UserDataDeletionResult> {
    const user = await this.appUserRepo.findById(tenantId, appUserId)
    if (!user) {
      throw new AppUserNotFoundError(appUserId)
    }

    return this.runTransaction(async (tx) => {
      // Create repos bound to this transaction
      const repos = this.repoFactory.createTransactional(tx)

      // 1. Delete events
      const eventsDeleted = await repos.eventRepo.deleteByAppUser(tenantId, appUserId)

      // 2. Remove from segments
      const segmentsRemoved = await repos.segmentRepo.removeMemberFromAll(tenantId, appUserId)

      // 3. Delete products
      const productsDeleted = await repos.productRepo.deleteByAppUser(tenantId, appUserId)

      // 4. Delete devices
      const devicesDeleted = await repos.deviceRepo.deleteByAppUser(tenantId, appUserId)

      // 5. Anonymize deliveries (NOT delete — preserves metrics)
      const deliveriesAnonymized = await repos.deliveryRepo.anonymizeByAppUser(tenantId, appUserId)

      // 6. Delete app_user
      await repos.appUserRepo.delete(tenantId, appUserId)

      // 7. Audit log (within same transaction)
      await repos.auditLog.log(tenantId, 'lgpd.user_data_deleted', 'app_user', appUserId, {
        deliveriesAnonymized: true,
        anonymizedDeliveryCount: deliveriesAnonymized,
        eventsDeleted,
        segmentsRemoved,
        productsDeleted,
        devicesDeleted,
      })

      return {
        eventsDeleted,
        segmentsRemoved,
        productsDeleted,
        devicesDeleted,
        deliveriesAnonymized,
      }
    })
  }
}
