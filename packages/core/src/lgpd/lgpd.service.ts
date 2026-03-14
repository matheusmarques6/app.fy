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

/** Transaction runner interface */
export interface TransactionRunner {
  transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T>
}

export interface LGPDServiceDeps {
  appUserRepo: LGPDAppUserRepository
  eventRepo: LGPDEventRepository
  segmentRepo: LGPDSegmentRepository
  productRepo: LGPDProductRepository
  deviceRepo: LGPDDeviceRepository
  deliveryRepo: LGPDDeliveryRepository
  auditLog: AuditLogger
  transactionRunner: TransactionRunner
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
  private readonly eventRepo: LGPDEventRepository
  private readonly segmentRepo: LGPDSegmentRepository
  private readonly productRepo: LGPDProductRepository
  private readonly deviceRepo: LGPDDeviceRepository
  private readonly deliveryRepo: LGPDDeliveryRepository
  private readonly auditLog: AuditLogger
  private readonly transactionRunner: TransactionRunner

  constructor(deps: LGPDServiceDeps) {
    this.appUserRepo = deps.appUserRepo
    this.eventRepo = deps.eventRepo
    this.segmentRepo = deps.segmentRepo
    this.productRepo = deps.productRepo
    this.deviceRepo = deps.deviceRepo
    this.deliveryRepo = deps.deliveryRepo
    this.auditLog = deps.auditLog
    this.transactionRunner = deps.transactionRunner
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
   * Executed in a single transaction:
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

    return this.transactionRunner.transaction(async () => {
      // 1. Delete events
      const eventsDeleted = await this.eventRepo.deleteByAppUser(tenantId, appUserId)

      // 2. Remove from segments
      const segmentsRemoved = await this.segmentRepo.removeMemberFromAll(tenantId, appUserId)

      // 3. Delete products
      const productsDeleted = await this.productRepo.deleteByAppUser(tenantId, appUserId)

      // 4. Delete devices
      const devicesDeleted = await this.deviceRepo.deleteByAppUser(tenantId, appUserId)

      // 5. Anonymize deliveries (NOT delete — preserves metrics)
      const deliveriesAnonymized = await this.deliveryRepo.anonymizeByAppUser(tenantId, appUserId)

      // 6. Delete app_user
      await this.appUserRepo.delete(tenantId, appUserId)

      // 7. Audit log
      await this.auditLog.log(tenantId, 'lgpd.user_data_deleted', 'app_user', appUserId, {
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
