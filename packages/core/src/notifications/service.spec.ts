import type { NotificationStatus, PaginationParams } from '@appfy/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { DomainError, InvalidStatusTransitionError, NotificationNotFoundError } from '../errors.js'
import type { CreateNotificationInput, Notification } from './types.js'
import { NotificationService } from './service.js'

function makeNotif(overrides: Partial<Notification> = {}): Notification {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tenantId: overrides.tenantId ?? 'tenant-1',
    type: 'manual', flowType: null,
    title: overrides.title ?? 'Test',
    body: overrides.body ?? 'Body',
    imageUrl: null, targetUrl: null,
    segmentRules: null, scheduledAt: null, sentAt: overrides.sentAt ?? null,
    status: overrides.status ?? 'draft',
    createdBy: null, abVariant: null, abConfig: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

class NotifRepoSpy {
  result: Notification | undefined = undefined
  listResult = { data: [] as Notification[], total: 0 }
  calls: Record<string, number> = {}
  lastArgs: Record<string, unknown[]> = {}
  private track(m: string, args: unknown[]) { this.calls[m] = (this.calls[m] ?? 0) + 1; this.lastArgs[m] = args }

  async create(t: string, input: CreateNotificationInput): Promise<Notification> {
    this.track('create', [t, input])
    return this.result ?? makeNotif({ tenantId: t, title: input.title, body: input.body })
  }
  async findById(t: string, id: string) { this.track('findById', [t, id]); return this.result }
  async list(t: string, p: PaginationParams, f?: unknown) { this.track('list', [t, p, f]); return this.listResult }
  async updateStatus(t: string, id: string, s: NotificationStatus, sentAt?: Date): Promise<Notification> {
    this.track('updateStatus', [t, id, s, sentAt])
    return this.result ?? makeNotif({ tenantId: t, status: s })
  }
  async delete(t: string, id: string) { this.track('delete', [t, id]) }
}

class AuditSpy {
  entries: Array<{ action: string; entityType: string }> = []
  async log(_t: string, action: string, entityType: string, _entityId: string, _meta?: unknown, _userId?: string) {
    this.entries.push({ action, entityType })
  }
}

describe('NotificationService (Layer 2)', () => {
  const tenantId = 'tenant-1'
  let repo: NotifRepoSpy
  let audit: AuditSpy
  let sut: NotificationService

  function makeSut() {
    repo = new NotifRepoSpy()
    audit = new AuditSpy()
    sut = new NotificationService({ notificationRepo: repo as never, auditLog: audit })
  }

  beforeEach(() => makeSut())

  describe('create', () => {
    it('should create notification', async () => {
      const result = await sut.create(tenantId, { type: 'manual', title: 'Test', body: 'Body' })
      expect(result).toBeDefined()
      expect(repo.calls.create).toBe(1)
    })

    it('should throw for empty title', async () => {
      await expect(sut.create(tenantId, { type: 'manual', title: '', body: 'Body' })).rejects.toThrow(DomainError)
    })

    it('should throw for whitespace title', async () => {
      await expect(sut.create(tenantId, { type: 'manual', title: '   ', body: 'Body' })).rejects.toThrow(DomainError)
    })

    it('should sanitize XSS from title', async () => {
      await sut.create(tenantId, { type: 'manual', title: 'Hello <script>alert(1)</script>', body: 'Body' })
      const [, input] = repo.lastArgs.create as [string, { title: string }]
      expect(input.title).not.toContain('<script>')
      expect(input.title).toContain('Hello')
    })

    it('should sanitize XSS from body', async () => {
      await sut.create(tenantId, { type: 'manual', title: 'Title', body: 'Click <img onerror="alert(1)" src="x">here' })
      const [, input] = repo.lastArgs.create as [string, { body: string }]
      expect(input.body).not.toContain('<img')
    })

    it('should create audit log entry', async () => {
      await sut.create(tenantId, { type: 'manual', title: 'Test', body: 'Body' })
      expect(audit.entries).toHaveLength(1)
      expect(audit.entries[0]!.action).toBe('notification.created')
    })

    it('should preserve accents and currency', async () => {
      await sut.create(tenantId, { type: 'manual', title: 'Promocao R$50', body: 'Ofertas' })
      const [, input] = repo.lastArgs.create as [string, { title: string }]
      expect(input.title).toContain('R$50')
    })
  })

  describe('getById', () => {
    it('should return when found', async () => {
      repo.result = makeNotif({ id: 'n-1', tenantId })
      expect((await sut.getById(tenantId, 'n-1')).id).toBe('n-1')
    })

    it('should throw NotificationNotFoundError', async () => {
      repo.result = undefined
      await expect(sut.getById(tenantId, 'x')).rejects.toThrow(NotificationNotFoundError)
    })
  })

  describe('updateStatus', () => {
    it('should allow draft -> scheduled', async () => {
      repo.result = makeNotif({ id: 'n-1', tenantId, status: 'draft' })
      await sut.updateStatus(tenantId, 'n-1', 'scheduled')
      expect(repo.calls.updateStatus).toBe(1)
    })

    it('should allow draft -> sending', async () => {
      repo.result = makeNotif({ id: 'n-1', tenantId, status: 'draft' })
      await sut.updateStatus(tenantId, 'n-1', 'sending')
      expect(repo.calls.updateStatus).toBe(1)
    })

    it('should allow sending -> sent', async () => {
      repo.result = makeNotif({ id: 'n-1', tenantId, status: 'sending' })
      await sut.updateStatus(tenantId, 'n-1', 'sent', new Date())
      expect(repo.calls.updateStatus).toBe(1)
    })

    it('should allow any -> failed', async () => {
      repo.result = makeNotif({ id: 'n-1', tenantId, status: 'sending' })
      await sut.updateStatus(tenantId, 'n-1', 'failed')
      expect(repo.calls.updateStatus).toBe(1)
    })

    it('should reject draft -> sent (skip stages)', async () => {
      repo.result = makeNotif({ id: 'n-1', tenantId, status: 'draft' })
      await expect(sut.updateStatus(tenantId, 'n-1', 'sent')).rejects.toThrow(InvalidStatusTransitionError)
    })

    it('should reject sent -> draft', async () => {
      repo.result = makeNotif({ id: 'n-1', tenantId, status: 'sent', sentAt: new Date() })
      await expect(sut.updateStatus(tenantId, 'n-1', 'draft')).rejects.toThrow(InvalidStatusTransitionError)
    })

    it('should create audit log on status change', async () => {
      repo.result = makeNotif({ id: 'n-1', tenantId, status: 'draft' })
      await sut.updateStatus(tenantId, 'n-1', 'scheduled')
      expect(audit.entries.some((e) => e.action === 'notification.status_changed')).toBe(true)
    })
  })

  describe('delete', () => {
    it('should delete existing', async () => {
      repo.result = makeNotif({ id: 'n-1', tenantId })
      await sut.delete(tenantId, 'n-1')
      expect(repo.calls.delete).toBe(1)
    })

    it('should throw if not found', async () => {
      repo.result = undefined
      await expect(sut.delete(tenantId, 'x')).rejects.toThrow(NotificationNotFoundError)
    })

    it('should audit log on delete', async () => {
      repo.result = makeNotif({ id: 'n-1', tenantId })
      await sut.delete(tenantId, 'n-1')
      expect(audit.entries.some((e) => e.action === 'notification.deleted')).toBe(true)
    })
  })

  describe('list', () => {
    it('should return paginated', async () => {
      repo.listResult = { data: [], total: 0 }
      const result = await sut.list(tenantId)
      expect(result.meta.page).toBe(1)
    })
  })
})
