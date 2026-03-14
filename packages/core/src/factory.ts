import type { Database } from '@appfy/db'
import { AnalyticsRepository, AnalyticsService } from './analytics/index.js'
import { LGPDService } from './lgpd/index.js'
import { ProductRepository } from './lgpd/product.repository.js'
import { RetentionService } from './retention/index.js'
import { AppConfigRepository, AppConfigService } from './app-configs/index.js'
import { AppUserRepository, AppUserService } from './app-users/index.js'
import { AuditLogRepository, AuditLogService } from './audit/index.js'
import { AutomationRepository, AutomationService } from './automations/index.js'
import { BillingService } from './billing/index.js'
import type { PlanPriceRegistry } from './billing/index.js'
import type { IdempotencyStore } from './billing/idempotency.js'
import { InMemoryIdempotencyStore } from './billing/idempotency.js'
import type { StripeClient } from './billing/stripe.provider.js'
import { StripeProvider } from './billing/stripe.provider.js'
import { BuildService } from './builds/index.js'
import { DeviceRepository, DeviceService } from './devices/index.js'
import { EncryptionService } from './encryption/service.js'
import { EventRepository, EventIngestionService } from './events/index.js'
import { MembershipRepository } from './memberships/index.js'
import { DrizzleDeliveryRepository } from './notifications/delivery.repository.js'
import { NotificationRepository, NotificationService } from './notifications/index.js'
import { OneSignalProvider } from './push/onesignal.provider.js'
import { PushDispatchService } from './push/push-dispatch.service.js'
import type { DeliveryRepository } from './push/push-dispatch.service.js'
import type { PushProvider } from './push/push-provider.interface.js'
import { PushService } from './push/push.service.js'
import { SegmentRepository, SegmentService } from './segments/index.js'
import { TenantRepository, TenantService } from './tenants/index.js'

export interface Dependencies {
  notificationRepo: NotificationRepository
  membershipRepo: MembershipRepository
  tenantRepo: TenantRepository
  appUserRepo: AppUserRepository
  deviceRepo: DeviceRepository
  automationRepo: AutomationRepository
  analyticsRepo: AnalyticsRepository
  appConfigRepo: AppConfigRepository
  segmentRepo: SegmentRepository
  auditLogRepo: AuditLogRepository
  eventRepo: EventRepository
  pushProvider: PushProvider
  stripeProvider: StripeProvider
  notificationService: NotificationService
  tenantService: TenantService
  appUserService: AppUserService
  deviceService: DeviceService
  automationService: AutomationService
  analyticsService: AnalyticsService
  appConfigService: AppConfigService
  segmentService: SegmentService
  billingService: BillingService
  buildService: BuildService
  pushService: PushService
  pushDispatchService: PushDispatchService
  encryptionService: EncryptionService
  auditLogService: AuditLogService
  eventIngestionService: EventIngestionService
  idempotencyStore: IdempotencyStore
  lgpdService: LGPDService
  retentionService: RetentionService
  productRepo: ProductRepository
}

export interface FactoryConfig {
  db: Database
  stripeClient: StripeClient
  stripeWebhookSecret: string
  planPriceRegistry: PlanPriceRegistry
  oneSignalApiKey: string
  encryptionSecret: string
}

export function createDependencies(
  config: FactoryConfig,
  overrides?: Partial<Dependencies>,
): Dependencies {
  const notificationRepo = overrides?.notificationRepo ?? new NotificationRepository(config.db)
  const membershipRepo = overrides?.membershipRepo ?? new MembershipRepository(config.db)
  const tenantRepo = overrides?.tenantRepo ?? new TenantRepository(config.db)
  const appUserRepo = overrides?.appUserRepo ?? new AppUserRepository(config.db)
  const deviceRepo = overrides?.deviceRepo ?? new DeviceRepository(config.db)
  const automationRepo = overrides?.automationRepo ?? new AutomationRepository(config.db)
  const analyticsRepo = overrides?.analyticsRepo ?? new AnalyticsRepository(config.db)
  const appConfigRepo = overrides?.appConfigRepo ?? new AppConfigRepository(config.db)
  const segmentRepo = overrides?.segmentRepo ?? new SegmentRepository(config.db)
  const eventRepo = overrides?.eventRepo ?? new EventRepository(config.db)
  const pushProvider = overrides?.pushProvider ?? new OneSignalProvider(config.oneSignalApiKey)
  const stripeProvider = overrides?.stripeProvider ?? new StripeProvider(config.stripeClient)

  const notificationService =
    overrides?.notificationService ?? new NotificationService(notificationRepo)
  const tenantService = overrides?.tenantService ?? new TenantService(tenantRepo)
  const appUserService = overrides?.appUserService ?? new AppUserService(appUserRepo)
  const deviceService =
    overrides?.deviceService ?? new DeviceService({ deviceRepo, appUserRepo })
  const automationService = overrides?.automationService ?? new AutomationService(automationRepo)
  const analyticsService = overrides?.analyticsService ?? new AnalyticsService(analyticsRepo)
  const appConfigService = overrides?.appConfigService ?? new AppConfigService(appConfigRepo)
  const segmentService = overrides?.segmentService ?? new SegmentService(segmentRepo)
  const pushService = overrides?.pushService ?? new PushService(pushProvider)
  const encryptionService =
    overrides?.encryptionService ?? new EncryptionService(config.encryptionSecret)
  const auditLogRepo = overrides?.auditLogRepo ?? new AuditLogRepository(config.db)
  const auditLogService = overrides?.auditLogService ?? new AuditLogService(auditLogRepo)
  const billingService = overrides?.billingService ?? new BillingService({
    stripeProvider,
    tenantRepo,
    auditLogService,
    planPriceRegistry: config.planPriceRegistry,
    webhookSecret: config.stripeWebhookSecret,
    automationRepo,
  })
  const deliveryRepo: DeliveryRepository = new DrizzleDeliveryRepository(config.db)
  const pushDispatchService =
    overrides?.pushDispatchService ??
    new PushDispatchService({
      deviceRepo,
      deliveryRepo,
      pushProvider,
      notificationRepo,
      tenantRepo,
    })
  const eventIngestionService =
    overrides?.eventIngestionService ??
    new EventIngestionService({ eventRepo })
  const idempotencyStore = overrides?.idempotencyStore ?? new InMemoryIdempotencyStore()
  const buildService =
    overrides?.buildService ??
    new BuildService({
      appConfigLookup: appConfigRepo,
      buildQueue: {
        async addBuildJob() {
          // BullMQ integration wired in apps/workers — this is a no-op default
        },
      },
    })

  const productRepo = overrides?.productRepo ?? new ProductRepository(config.db)
  const lgpdService =
    overrides?.lgpdService ??
    new LGPDService({
      appUserRepo,
      eventRepo,
      segmentRepo,
      productRepo,
      deviceRepo,
      deliveryRepo: {
        async anonymizeByAppUser(tenantId: string, appUserId: string) {
          return (deliveryRepo as import('./notifications/delivery.repository.js').DrizzleDeliveryRepository).anonymizeByAppUser(tenantId, appUserId)
        },
      },
      auditLog: auditLogService,
      transactionRunner: {
        async transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
          return config.db.transaction((tx) => fn(tx))
        },
      },
    })
  const retentionService =
    overrides?.retentionService ??
    new RetentionService({
      deliveryRepo: {
        async deleteExpiredBefore(date: Date, batchSize: number) {
          return (deliveryRepo as import('./notifications/delivery.repository.js').DrizzleDeliveryRepository).deleteExpiredBefore(date, batchSize)
        },
      },
      eventRepo: {
        async deleteExpiredBefore(date: Date, batchSize: number) {
          return eventRepo.deleteExpiredBefore(date, batchSize)
        },
      },
    })

  return {
    notificationRepo,
    membershipRepo,
    tenantRepo,
    appUserRepo,
    deviceRepo,
    automationRepo,
    analyticsRepo,
    appConfigRepo,
    segmentRepo,
    auditLogRepo,
    eventRepo,
    pushProvider,
    stripeProvider,
    notificationService,
    tenantService,
    appUserService,
    deviceService,
    automationService,
    analyticsService,
    appConfigService,
    segmentService,
    billingService,
    buildService,
    pushService,
    pushDispatchService,
    encryptionService,
    auditLogService,
    eventIngestionService,
    idempotencyStore,
    lgpdService,
    retentionService,
    productRepo,
  }
}
