import { SpyBase } from './spy-base.js'

export interface AuditLogEntry {
  readonly id: string
  readonly tenantId: string
  readonly userId: string | null
  readonly action: string
  readonly entityType: string
  readonly entityId: string
  readonly metadata: Record<string, unknown> | null
  readonly createdAt: Date
}

/** Mirrors audit log repository contract (internal to test-utils) */
export class AuditLogRepositorySpy extends SpyBase {
  private entries: AuditLogEntry[] = []

  async log(
    tenantId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>,
    userId?: string,
  ): Promise<void> {
    this.trackCall('log', [tenantId, action, entityType, entityId, metadata, userId])
    this.entries.push({
      id: crypto.randomUUID(),
      tenantId,
      userId: userId ?? null,
      action,
      entityType,
      entityId,
      metadata: metadata ?? null,
      createdAt: new Date(),
    })
  }

  async findByEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<AuditLogEntry[]> {
    this.trackCall('findByEntity', [tenantId, entityType, entityId])
    return this.entries.filter(
      (e) => e.tenantId === tenantId && e.entityType === entityType && e.entityId === entityId,
    )
  }

  /** Returns all recorded audit log entries */
  getEntries(): AuditLogEntry[] {
    return [...this.entries]
  }

  override reset(): void {
    super.reset()
    this.entries = []
  }
}
