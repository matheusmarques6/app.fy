/** Repository interface for batch-deleting expired deliveries */
export interface DeliveryRetentionRepository {
  deleteExpiredBefore(date: Date, batchSize: number): Promise<number>
}

/** Repository interface for batch-deleting expired events */
export interface EventRetentionRepository {
  deleteExpiredBefore(date: Date, batchSize: number): Promise<number>
}

export interface RetentionServiceDeps {
  deliveryRepo: DeliveryRetentionRepository
  eventRepo: EventRetentionRepository
  /** Number of rows to delete per batch iteration. Defaults to 1000. */
  batchSize?: number
}

export interface RetentionResult {
  readonly deliveriesDeleted: number
  readonly eventsDeleted: number
}

/** Retention period constants (days) */
const DELIVERY_RETENTION_DAYS = 180
const EVENT_RETENTION_DAYS = 90

/**
 * Data Retention Service.
 *
 * Cleans expired data globally (not per tenant):
 * - notification_deliveries: 180 days
 * - app_events: 90 days
 *
 * Boundary: exactly N days -> kept. N+1 days -> deleted.
 * Batch delete: processes `batchSize` rows per iteration to avoid table locking.
 */
export class RetentionService {
  private readonly deliveryRepo: DeliveryRetentionRepository
  private readonly eventRepo: EventRetentionRepository
  private readonly batchSize: number

  constructor(deps: RetentionServiceDeps) {
    this.deliveryRepo = deps.deliveryRepo
    this.eventRepo = deps.eventRepo
    this.batchSize = deps.batchSize ?? 1000
  }

  /**
   * Delete notification_deliveries older than 180 days.
   * Processes in batches to avoid long locks.
   * @returns total number of deleted rows
   */
  async cleanExpiredDeliveries(): Promise<number> {
    const cutoff = this.computeCutoff(DELIVERY_RETENTION_DAYS)
    return this.batchDelete(cutoff, (date, batch) =>
      this.deliveryRepo.deleteExpiredBefore(date, batch),
    )
  }

  /**
   * Delete app_events older than 90 days.
   * Processes in batches to avoid long locks.
   * @returns total number of deleted rows
   */
  async cleanExpiredEvents(): Promise<number> {
    const cutoff = this.computeCutoff(EVENT_RETENTION_DAYS)
    return this.batchDelete(cutoff, (date, batch) =>
      this.eventRepo.deleteExpiredBefore(date, batch),
    )
  }

  /**
   * Run all retention jobs.
   * @returns summary of deleted rows
   */
  async runAll(): Promise<RetentionResult> {
    const deliveriesDeleted = await this.cleanExpiredDeliveries()
    const eventsDeleted = await this.cleanExpiredEvents()
    return { deliveriesDeleted, eventsDeleted }
  }

  /**
   * Computes the cutoff date: exactly N days ago from now.
   * Records created at exactly the cutoff time are kept (strict less-than).
   */
  private computeCutoff(days: number): Date {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return cutoff
  }

  /**
   * Iteratively deletes batches until a batch returns 0 (no more rows).
   */
  private async batchDelete(
    cutoff: Date,
    deleteFn: (date: Date, batchSize: number) => Promise<number>,
  ): Promise<number> {
    let totalDeleted = 0
    let deleted: number

    do {
      deleted = await deleteFn(cutoff, this.batchSize)
      totalDeleted += deleted
    } while (deleted > 0)

    return totalDeleted
  }
}
