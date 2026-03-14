import { describe, it, expect } from 'vitest'
import type { DeliveryStatus } from '@appfy/shared'
import { NotificationNotFoundError } from '../errors.js'
import { PushDispatchService } from './push-dispatch.service.js'
import type {
  DeliveryRow,
  CreateDeliveryInput,
  RetryQueueAdapter,
} from './push-dispatch.service.js'
import type { DeviceRepository } from '../devices/repository.js'
import type { DeviceRow } from '../devices/repository.js'
import type {
  PushProvider,
  PushNotificationPayload,
  PushResult,
  PushDeliveryStatus,
} from './push-provider.interface.js'
import type { Notification } from '../notifications/types.js'

// --- Inline helpers ---

function makeDevice(overrides: Partial<DeviceRow> = {}): DeviceRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tenantId: overrides.tenantId ?? 'tenant-1',
    appUserId: overrides.appUserId ?? 'user-1',
    deviceToken: overrides.deviceToken ?? `token-${crypto.randomUUID().slice(0, 8)}`,
    platform: overrides.platform ?? 'android',
    osVersion: overrides.osVersion ?? null,
    appVersion: overrides.appVersion ?? null,
    isActive: overrides.isActive ?? true,
    lastSeenAt: overrides.lastSeenAt ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tenantId: overrides.tenantId ?? 'tenant-1',
    type: overrides.type ?? 'manual',
    flowType: overrides.flowType ?? null,
    title: overrides.title ?? 'Test Notification',
    body: overrides.body ?? 'Test body',
    imageUrl: overrides.imageUrl ?? null,
    targetUrl: overrides.targetUrl ?? null,
    segmentRules: overrides.segmentRules ?? null,
    scheduledAt: overrides.scheduledAt ?? null,
    sentAt: overrides.sentAt ?? null,
    status: overrides.status ?? 'draft',
    createdBy: overrides.createdBy ?? null,
    abVariant: overrides.abVariant ?? null,
    abConfig: overrides.abConfig ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

function makeDelivery(overrides: Partial<DeliveryRow> = {}): DeliveryRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tenantId: overrides.tenantId ?? 'tenant-1',
    notificationId: overrides.notificationId ?? crypto.randomUUID(),
    deviceId: overrides.deviceId ?? crypto.randomUUID(),
    appUserId: overrides.appUserId ?? null,
    status: overrides.status ?? 'pending',
    sentAt: overrides.sentAt ?? null,
    deliveredAt: overrides.deliveredAt ?? null,
    openedAt: overrides.openedAt ?? null,
    clickedAt: overrides.clickedAt ?? null,
    convertedAt: overrides.convertedAt ?? null,
    errorMessage: overrides.errorMessage ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

// --- Inline Spies ---

class SpyTracker {
  private _calls = new Map<string, { count: number; lastArgs: unknown[] }>()

  protected track(method: string, args: unknown[]): void {
    const existing = this._calls.get(method) ?? { count: 0, lastArgs: [] }
    this._calls.set(method, { count: existing.count + 1, lastArgs: args })
  }
  callCount(method: string): number {
    return this._calls.get(method)?.count ?? 0
  }
  wasCalled(method: string): boolean {
    return this.callCount(method) > 0
  }
  lastCallArgs(method: string): unknown[] {
    return this._calls.get(method)?.lastArgs ?? []
  }
}

class DeviceRepoSpy extends SpyTracker {
  activeDevices: DeviceRow[] = []

  async findActiveByUser(tenantId: string, appUserId: string): Promise<DeviceRow[]> {
    this.track('findActiveByUser', [tenantId, appUserId])
    return this.activeDevices.filter((d) => d.appUserId === appUserId)
  }
  async findById(): Promise<DeviceRow | undefined> { return undefined }
  async findByTokenAndPlatform(): Promise<DeviceRow[]> { return [] }
  async register(): Promise<DeviceRow> { return makeDevice() }
  async deactivate(): Promise<void> {}
  async deactivateByUserAndPlatform(): Promise<void> {}
  async updateLastSeen(): Promise<void> {}
  async countByUser(): Promise<number> { return 0 }
}

class DeliveryRepoSpy extends SpyTracker {
  async create(tenantId: string, notificationId: string, deviceId: string): Promise<DeliveryRow> {
    this.track('create', [tenantId, notificationId, deviceId])
    return makeDelivery({ tenantId, notificationId, deviceId })
  }

  async createMany(tenantId: string, records: CreateDeliveryInput[]): Promise<DeliveryRow[]> {
    this.track('createMany', [tenantId, records])
    return records.map((rec) =>
      makeDelivery({ tenantId, notificationId: rec.notificationId, deviceId: rec.deviceId }),
    )
  }

  async updateStatus(tenantId: string, id: string, status: DeliveryStatus): Promise<void> {
    this.track('updateStatus', [tenantId, id, status])
  }

  async updateManyStatus(tenantId: string, ids: string[], status: DeliveryStatus, timestamp?: Date): Promise<void> {
    this.track('updateManyStatus', [tenantId, ids, status, timestamp])
  }
}

class PushProviderSpy extends SpyTracker implements PushProvider {
  sendResult: PushResult = { externalId: 'ext-1', recipientCount: 1 }
  shouldFail = false

  async createApp(): Promise<{ appId: string }> { return { appId: 'test-app' } }

  async sendNotification(appId: string, notification: PushNotificationPayload): Promise<PushResult> {
    this.track('sendNotification', [appId, notification])
    if (this.shouldFail) throw new Error('Provider failure')
    return this.sendResult
  }

  async getDeliveryStatus(): Promise<PushDeliveryStatus> {
    return { successful: 1, failed: 0, remaining: 0 }
  }

  async registerDevice(): Promise<{ playerId: string }> {
    return { playerId: 'player-1' }
  }
}

class NotificationRepoSpy {
  result: Notification | undefined = undefined

  async findById(_tenantId: string, _id: string): Promise<Notification | undefined> {
    return this.result
  }
}

class RetryQueueSpy extends SpyTracker implements RetryQueueAdapter {
  private _jobs: Array<{ name: string; data: unknown; opts?: Record<string, unknown> }> = []

  async add(name: string, data: unknown, opts?: Record<string, unknown>): Promise<{ id: string }> {
    this.track('add', [name, data, opts])
    this._jobs.push({ name, data, opts })
    return { id: crypto.randomUUID() }
  }

  get jobs() {
    return [...this._jobs]
  }
}

// --- Test Suite ---

function makeSut(opts?: { withRetryQueue?: boolean }) {
  const deviceRepo = new DeviceRepoSpy()
  const deliveryRepo = new DeliveryRepoSpy()
  const pushProvider = new PushProviderSpy()
  const notificationRepo = new NotificationRepoSpy()
  const retryQueue = opts?.withRetryQueue ? new RetryQueueSpy() : undefined

  const sut = new PushDispatchService({
    deviceRepo: deviceRepo as unknown as DeviceRepository,
    deliveryRepo,
    pushProvider,
    notificationRepo,
    retryQueue,
  })

  return { sut, deviceRepo, deliveryRepo, pushProvider, notificationRepo, retryQueue }
}

describe('PushDispatchService', () => {
  const tenantId = 'tenant-1'
  const notificationId = 'notif-1'
  const appId = 'onesignal-app-1'

  describe('dispatch', () => {
    it('should create delivery records for each active device and send via provider', async () => {
      const { sut, deviceRepo, deliveryRepo, pushProvider, notificationRepo } = makeSut()
      const userId1 = 'user-1'
      const userId2 = 'user-2'

      notificationRepo.result = makeNotification({ tenantId, title: 'Promo', body: 'Buy now' })
      deviceRepo.activeDevices = [
        makeDevice({ tenantId, appUserId: userId1, deviceToken: 'token-1' }),
        makeDevice({ tenantId, appUserId: userId1, deviceToken: 'token-2' }),
        makeDevice({ tenantId, appUserId: userId2, deviceToken: 'token-3' }),
      ]

      const result = await sut.dispatch(tenantId, notificationId, [userId1, userId2], appId)

      expect(result.status).toBe('sent')
      expect(result.recipientCount).toBe(3)
      expect(result.deliveryIds).toHaveLength(3)
      expect(deliveryRepo.wasCalled('createMany')).toBe(true)
      expect(pushProvider.wasCalled('sendNotification')).toBe(true)

      const [, payload] = pushProvider.lastCallArgs('sendNotification') as [string, PushNotificationPayload]
      expect(payload.playerIds).toEqual(['token-1', 'token-2', 'token-3'])
    })

    it('should return no_recipients when 0 active devices', async () => {
      const { sut, deviceRepo, pushProvider, notificationRepo } = makeSut()
      notificationRepo.result = makeNotification({ tenantId })
      deviceRepo.activeDevices = []

      const result = await sut.dispatch(tenantId, notificationId, ['user-1'], appId)

      expect(result.status).toBe('no_recipients')
      expect(result.recipientCount).toBe(0)
      expect(result.deliveryIds).toHaveLength(0)
      expect(pushProvider.wasCalled('sendNotification')).toBe(false)
    })

    it('should throw NotificationNotFoundError when notification does not exist', async () => {
      const { sut, notificationRepo } = makeSut()
      notificationRepo.result = undefined

      await expect(
        sut.dispatch(tenantId, notificationId, ['user-1'], appId),
      ).rejects.toThrow(NotificationNotFoundError)
    })

    it('should update delivery statuses to sent on success', async () => {
      const { sut, deviceRepo, deliveryRepo, notificationRepo } = makeSut()
      notificationRepo.result = makeNotification({ tenantId })
      deviceRepo.activeDevices = [makeDevice({ tenantId, appUserId: 'user-1', deviceToken: 'token-1' })]

      await sut.dispatch(tenantId, notificationId, ['user-1'], appId)

      expect(deliveryRepo.wasCalled('updateManyStatus')).toBe(true)
      const [, , status] = deliveryRepo.lastCallArgs('updateManyStatus')
      expect(status).toBe('sent')
    })

    it('should update delivery statuses to failed when provider throws', async () => {
      const { sut, deviceRepo, deliveryRepo, pushProvider, notificationRepo } = makeSut()
      notificationRepo.result = makeNotification({ tenantId })
      deviceRepo.activeDevices = [makeDevice({ tenantId, appUserId: 'user-1', deviceToken: 'token-1' })]
      pushProvider.shouldFail = true

      const result = await sut.dispatch(tenantId, notificationId, ['user-1'], appId)

      expect(result.status).toBe('failed')
      expect(deliveryRepo.wasCalled('updateManyStatus')).toBe(true)
      const [, , status] = deliveryRepo.lastCallArgs('updateManyStatus')
      expect(status).toBe('failed')
    })

    it('should include deep link ref in push payload', async () => {
      const { sut, deviceRepo, pushProvider, notificationRepo } = makeSut()
      notificationRepo.result = makeNotification({ tenantId })
      deviceRepo.activeDevices = [makeDevice({ tenantId, appUserId: 'user-1', deviceToken: 'token-1' })]

      await sut.dispatch(tenantId, notificationId, ['user-1'], appId)

      const [, payload] = pushProvider.lastCallArgs('sendNotification') as [string, PushNotificationPayload]
      expect(payload.data).toEqual({ ref: `push_${notificationId}` })
    })

    it('should only include devices with tokens in playerIds', async () => {
      const { sut, deviceRepo, pushProvider, notificationRepo } = makeSut()
      notificationRepo.result = makeNotification({ tenantId })
      deviceRepo.activeDevices = [
        makeDevice({ tenantId, appUserId: 'user-1', deviceToken: 'token-1' }),
        { ...makeDevice({ tenantId, appUserId: 'user-1' }), deviceToken: null },
      ]

      const result = await sut.dispatch(tenantId, notificationId, ['user-1'], appId)

      expect(result.status).toBe('sent')
      const [, payload] = pushProvider.lastCallArgs('sendNotification') as [string, PushNotificationPayload]
      expect(payload.playerIds).toEqual(['token-1'])
    })

    it('should queue for retry when provider fails and retryQueue is available', async () => {
      const { sut, deviceRepo, pushProvider, notificationRepo, retryQueue } = makeSut({ withRetryQueue: true })
      notificationRepo.result = makeNotification({ tenantId })
      deviceRepo.activeDevices = [makeDevice({ tenantId, appUserId: 'user-1', deviceToken: 'token-1' })]
      pushProvider.shouldFail = true

      const result = await sut.dispatch(tenantId, notificationId, ['user-1'], appId)

      expect(result.status).toBe('failed')
      expect(retryQueue!.wasCalled('add')).toBe(true)
      expect(retryQueue!.jobs[0].name).toBe('push-dispatch-retry')
    })

    it('should not throw when provider fails and no retryQueue is configured', async () => {
      const { sut, deviceRepo, pushProvider, notificationRepo } = makeSut()
      notificationRepo.result = makeNotification({ tenantId })
      deviceRepo.activeDevices = [makeDevice({ tenantId, appUserId: 'user-1', deviceToken: 'token-1' })]
      pushProvider.shouldFail = true

      const result = await sut.dispatch(tenantId, notificationId, ['user-1'], appId)

      expect(result.status).toBe('failed')
      // no throw — graceful without retry queue
    })
  })
})
