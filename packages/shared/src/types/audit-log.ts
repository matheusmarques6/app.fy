/** Audit log entry for tracking actions */
export interface AuditLog {
  readonly id: string
  readonly tenantId: string
  readonly userId: string | null
  readonly action: string
  readonly resource: string
  readonly resourceId: string | null
  readonly details: Record<string, unknown> | null
  readonly createdAt: Date
}
