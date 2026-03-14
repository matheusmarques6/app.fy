import { describe, expect, it, beforeEach } from 'vitest'
import { AuditLogService } from './audit-log.service.js'
import type { AuditLogEntry, CreateAuditLogInput } from './audit-log.repository.js'
import type { PaginationParams } from '@appfy/shared'

class AuditLogRepoSpy {
  createCalls: Array<{ tenantId: string; input: CreateAuditLogInput }> = []
  listCalls: Array<{ tenantId: string; pagination: PaginationParams }> = []
  findByIdCalls: Array<{ tenantId: string; id: string }> = []

  listResult = { data: [] as AuditLogEntry[], total: 0 }
  findByIdResult: AuditLogEntry | undefined = undefined

  async create(tenantId: string, input: CreateAuditLogInput): Promise<AuditLogEntry> {
    this.createCalls.push({ tenantId, input })
    return {
      id: crypto.randomUUID(),
      tenantId,
      userId: input.userId ?? null,
      action: input.action,
      resource: input.resource,
      details: input.details ?? null,
      createdAt: new Date(),
    }
  }

  async list(tenantId: string, pagination: PaginationParams) {
    this.listCalls.push({ tenantId, pagination })
    return this.listResult
  }

  async findById(tenantId: string, id: string) {
    this.findByIdCalls.push({ tenantId, id })
    return this.findByIdResult
  }
}

describe('AuditLogService (Layer 2)', () => {
  const tenantId = 'tenant-1'
  let repo: AuditLogRepoSpy
  let sut: AuditLogService

  function makeSut() {
    repo = new AuditLogRepoSpy()
    sut = new AuditLogService(repo as never)
  }

  beforeEach(() => {
    makeSut()
  })

  describe('log()', () => {
    it('should create an audit entry with action and resource', async () => {
      await sut.log(tenantId, 'notification.created', 'notification', 'notif-123')

      expect(repo.createCalls).toHaveLength(1)
      expect(repo.createCalls[0]!.tenantId).toBe(tenantId)
      expect(repo.createCalls[0]!.input.action).toBe('notification.created')
      expect(repo.createCalls[0]!.input.resource).toBe('notification:notif-123')
    })

    it('should include metadata when provided', async () => {
      const meta = { from: 'draft', to: 'sent' }
      await sut.log(tenantId, 'notification.status_changed', 'notification', 'n-1', meta)

      expect(repo.createCalls[0]!.input.details).toEqual(meta)
    })

    it('should include userId when provided', async () => {
      await sut.log(tenantId, 'tenant.updated', 'tenant', 't-1', undefined, 'user-42')

      expect(repo.createCalls[0]!.input.userId).toBe('user-42')
    })

    it('should pass undefined details when no metadata provided', async () => {
      await sut.log(tenantId, 'action', 'resource', 'id-1')

      expect(repo.createCalls[0]!.input.details).toBeUndefined()
    })
  })

  describe('list()', () => {
    it('should return paginated audit log entries', async () => {
      const entry: AuditLogEntry = {
        id: 'entry-1',
        tenantId,
        userId: null,
        action: 'test',
        resource: 'test:1',
        details: null,
        createdAt: new Date(),
      }
      repo.listResult = { data: [entry], total: 1 }

      const result = await sut.list(tenantId, { page: 1, perPage: 20 })

      expect(result.data).toHaveLength(1)
      expect(result.meta.total).toBe(1)
    })

    it('should normalize pagination defaults', async () => {
      await sut.list(tenantId)

      expect(repo.listCalls).toHaveLength(1)
      expect(repo.listCalls[0]!.pagination.page).toBeGreaterThanOrEqual(1)
      expect(repo.listCalls[0]!.pagination.perPage).toBeGreaterThan(0)
    })
  })

  describe('getById()', () => {
    it('should return entry when found', async () => {
      const entry: AuditLogEntry = {
        id: 'entry-1',
        tenantId,
        userId: null,
        action: 'test',
        resource: 'test:1',
        details: null,
        createdAt: new Date(),
      }
      repo.findByIdResult = entry

      const result = await sut.getById(tenantId, 'entry-1')

      expect(result).toEqual(entry)
      expect(repo.findByIdCalls[0]!.id).toBe('entry-1')
    })

    it('should return undefined when not found', async () => {
      repo.findByIdResult = undefined

      const result = await sut.getById(tenantId, 'nonexistent')

      expect(result).toBeUndefined()
    })
  })

  describe('AuditLogger interface compliance', () => {
    it('should implement the AuditLogger interface (used by NotificationService)', async () => {
      // The service implements AuditLogger which requires:
      // log(tenantId, action, entityType, entityId, metadata?, userId?): Promise<void>
      expect(typeof sut.log).toBe('function')

      // Fire-and-forget: log should return void
      const result = await sut.log(tenantId, 'test', 'entity', 'id-1')
      expect(result).toBeUndefined()
    })
  })
})
