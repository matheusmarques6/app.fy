import type { Database } from '@appfy/db'
import { AnalyticsRepository, AnalyticsService } from './analytics/index.js'
import { AppUserRepository, AppUserService } from './app-users/index.js'
import { AutomationRepository, AutomationService } from './automations/index.js'
import { BillingService } from './billing/index.js'
import { StripeProvider } from './billing/stripe.provider.js'
import { DeviceRepository, DeviceService } from './devices/index.js'
import { EncryptionService } from './encryption/service.js'
import { NotificationRepository, NotificationService } from './notifications/index.js'
import { OneSignalProvider } from './push/onesignal.provider.js'
import type { PushProvider } from './push/push-provider.interface.js'
import { PushService } from './push/push.service.js'
import { TenantRepository, TenantService } from './tenants/index.js'

export interface Dependencies {
  notificationRepo: NotificationRepository
  tenantRepo: TenantRepository
  appUserRepo: AppUserRepository
  deviceRepo: DeviceRepository
  automationRepo: AutomationRepository
  analyticsRepo: AnalyticsRepository
  pushProvider: PushProvider
  stripeProvider: StripeProvider
  notificationService: NotificationService
  tenantService: TenantService
  appUserService: AppUserService
  deviceService: DeviceService
  automationService: AutomationService
  analyticsService: AnalyticsService
  billingService: BillingService
  pushService: PushService
  encryptionService: EncryptionService
}

export interface FactoryConfig {
  db: Database
  stripeSecretKey: string
  oneSignalApiKey: string
  encryptionSecret: string
}

export function createDependencies(
  config: FactoryConfig,
  overrides?: Partial<Dependencies>,
): Dependencies {
  const notificationRepo = overrides?.notificationRepo ?? new NotificationRepository(config.db)
  const tenantRepo = overrides?.tenantRepo ?? new TenantRepository(config.db)
  const appUserRepo = overrides?.appUserRepo ?? new AppUserRepository(config.db)
  const deviceRepo = overrides?.deviceRepo ?? new DeviceRepository(config.db)
  const automationRepo = overrides?.automationRepo ?? new AutomationRepository(config.db)
  const analyticsRepo = overrides?.analyticsRepo ?? new AnalyticsRepository(config.db)
  const pushProvider = overrides?.pushProvider ?? new OneSignalProvider(config.oneSignalApiKey)
  const stripeProvider = overrides?.stripeProvider ?? new StripeProvider(config.stripeSecretKey)

  const notificationService =
    overrides?.notificationService ?? new NotificationService(notificationRepo)
  const tenantService = overrides?.tenantService ?? new TenantService(tenantRepo)
  const appUserService = overrides?.appUserService ?? new AppUserService(appUserRepo)
  const deviceService = overrides?.deviceService ?? new DeviceService(deviceRepo)
  const automationService = overrides?.automationService ?? new AutomationService(automationRepo)
  const analyticsService = overrides?.analyticsService ?? new AnalyticsService(analyticsRepo)
  const billingService = overrides?.billingService ?? new BillingService(config.stripeSecretKey)
  const pushService = overrides?.pushService ?? new PushService(pushProvider)
  const encryptionService =
    overrides?.encryptionService ?? new EncryptionService(config.encryptionSecret)

  return {
    notificationRepo,
    tenantRepo,
    appUserRepo,
    deviceRepo,
    automationRepo,
    analyticsRepo,
    pushProvider,
    stripeProvider,
    notificationService,
    tenantService,
    appUserService,
    deviceService,
    automationService,
    analyticsService,
    billingService,
    pushService,
    encryptionService,
  }
}
