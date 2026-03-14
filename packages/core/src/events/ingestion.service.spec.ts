import { describe, it, expect } from 'vitest'
import { InvalidEventTypeError } from '../errors.js'
import { EventIngestionService } from './ingestion.service.js'
import type { EventRepository } from './repository.js'
import type { AppEventRow, CreateEventInput } from './types.js'
import type { EventQueueAdapter } from './ingestion.service.js'

// --- Inline helpers ---

function makeEvent(overrides: Partial<AppEventRow> = {}): AppEventRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tenantId: overrides.tenantId ?? 'tenant-1',
    appUserId: overrides.appUserId ?? 'user-1',
    eventType: overrides.eventType ?? 'app_opened',
    properties: overrides.properties ?? null,
    createdAt: overrides.createdAt ?? new Date(),
  }
}

// --- Spy implementations ---

class EventRepoSpy {
  createResult: AppEventRow = makeEvent()
  findRecentResult: AppEventRow[] = []
  private _calls = new Map<string, { count: number; lastArgs: unknown[] }>()

  async create(tenantId: string, input: CreateEventInput): Promise<AppEventRow> {
    this.track('create', [tenantId, input])
    return makeEvent({
      tenantId,
      appUserId: input.appUserId,
      eventType: input.eventType,
      properties: input.properties ?? null,
    })
  }

  async findRecent(
    tenantId: string,
    appUserId: string,
    eventType: string,
    withinSeconds: number,
  ): Promise<AppEventRow[]> {
    this.track('findRecent', [tenantId, appUserId, eventType, withinSeconds])
    return this.findRecentResult
  }

  async findById(): Promise<AppEventRow | undefined> {
    return undefined
  }
  async list(): Promise<{ data: AppEventRow[]; total: number }> {
    return { data: [], total: 0 }
  }
  async count(): Promise<number> {
    return 0
  }

  private track(method: string, args: unknown[]): void {
    const existing = this._calls.get(method) ?? { count: 0, lastArgs: [] }
    this._calls.set(method, { count: existing.count + 1, lastArgs: args })
  }
  callCount(method: string): number {
    return this._calls.get(method)?.count ?? 0
  }
  lastCallArgs(method: string): unknown[] {
    return this._calls.get(method)?.lastArgs ?? []
  }
  wasCalled(method: string): boolean {
    return this.callCount(method) > 0
  }
}

class QueueSpy implements EventQueueAdapter {
  private _jobs: Array<{ name: string; data: unknown }> = []

  async add(name: string, data: unknown): Promise<{ id: string }> {
    this._jobs.push({ name, data })
    return { id: crypto.randomUUID() }
  }

  get jobs() {
    return [...this._jobs]
  }
}

// --- Test Suite ---

function makeSut() {
  const eventRepo = new EventRepoSpy()
  const queueAdapter = new QueueSpy()
  const sut = new EventIngestionService({
    eventRepo: eventRepo as unknown as EventRepository,
    queueAdapter,
  })
  return { sut, eventRepo, queueAdapter }
}

describe('EventIngestionService', () => {
  describe('ingest', () => {
    const tenantId = 'tenant-1'
    const appUserId = 'user-1'

    it('should create event for valid event type', async () => {
      const { sut, eventRepo } = makeSut()

      const result = await sut.ingest(tenantId, { appUserId, eventType: 'app_opened' })

      expect(result).not.toBeNull()
      expect(eventRepo.wasCalled('create')).toBe(true)
      const [calledTenantId, calledInput] = eventRepo.lastCallArgs('create')
      expect(calledTenantId).toBe(tenantId)
      expect((calledInput as CreateEventInput).eventType).toBe('app_opened')
    })

    it('should throw InvalidEventTypeError for unknown event type', async () => {
      const { sut } = makeSut()

      await expect(
        sut.ingest(tenantId, { appUserId, eventType: 'unknown_event' }),
      ).rejects.toThrow(InvalidEventTypeError)
    })

    it('should return null for duplicate event within 5s (dedup)', async () => {
      const { sut, eventRepo } = makeSut()
      eventRepo.findRecentResult = [makeEvent({ tenantId })]

      const result = await sut.ingest(tenantId, { appUserId, eventType: 'product_viewed' })

      expect(result).toBeNull()
      expect(eventRepo.wasCalled('create')).toBe(false)
    })

    it('should create event when no recent duplicate exists', async () => {
      const { sut, eventRepo } = makeSut()
      eventRepo.findRecentResult = []

      const result = await sut.ingest(tenantId, { appUserId, eventType: 'product_viewed' })

      expect(result).not.toBeNull()
      expect(eventRepo.wasCalled('create')).toBe(true)
    })

    it('should queue async processing job on data-ingestion queue', async () => {
      const { sut, queueAdapter } = makeSut()

      await sut.ingest(tenantId, { appUserId, eventType: 'purchase_completed' })

      expect(queueAdapter.jobs).toHaveLength(1)
      const job = queueAdapter.jobs[0]!
      expect(job.name).toBe('process-event')
      const jobData = job.data as Record<string, unknown>
      expect(jobData.tenantId).toBe(tenantId)
      expect(jobData.eventType).toBe('purchase_completed')
      expect(jobData.appUserId).toBe(appUserId)
    })

    it('should store event with correct tenantId, appUserId, eventType and properties', async () => {
      const { sut } = makeSut()
      const properties = { productId: 'prod-1', price: 29.99 }

      const result = await sut.ingest(tenantId, { appUserId, eventType: 'add_to_cart', properties })

      expect(result).not.toBeNull()
      expect(result!.tenantId).toBe(tenantId)
      expect(result!.appUserId).toBe(appUserId)
      expect(result!.eventType).toBe('add_to_cart')
      expect(result!.properties).toEqual(properties)
    })

    it.each([
      'app_opened',
      'product_viewed',
      'add_to_cart',
      'purchase_completed',
      'push_opened',
      'push_clicked',
    ] as const)('should accept valid event type: %s', async (eventType) => {
      const { sut } = makeSut()

      const result = await sut.ingest(tenantId, { appUserId, eventType })

      expect(result).not.toBeNull()
    })

    it('should pass null properties when not provided', async () => {
      const { sut } = makeSut()

      const result = await sut.ingest(tenantId, { appUserId, eventType: 'app_opened' })

      expect(result).not.toBeNull()
      expect(result!.properties).toBeNull()
    })

    it('should call findRecent with 5 second dedup window', async () => {
      const { sut, eventRepo } = makeSut()

      await sut.ingest(tenantId, { appUserId, eventType: 'app_opened' })

      expect(eventRepo.wasCalled('findRecent')).toBe(true)
      const [, , , withinSeconds] = eventRepo.lastCallArgs('findRecent')
      expect(withinSeconds).toBe(5)
    })

    it('should not throw when no queueAdapter is provided', async () => {
      const eventRepo = new EventRepoSpy()
      const sut = new EventIngestionService({
        eventRepo: eventRepo as unknown as EventRepository,
      })

      const result = await sut.ingest(tenantId, { appUserId, eventType: 'app_opened' })

      expect(result).not.toBeNull()
    })
  })
})
