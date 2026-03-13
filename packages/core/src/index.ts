// Factory DI
export type { Dependencies, FactoryConfig } from './factory.js'
export { createDependencies } from './factory.js'

// Domain Errors

export type {
  AnalyticsOverview,
  AnalyticsPeriod,
  FlowAnalytics,
  NotificationAnalytics,
} from './analytics/index.js'
// Analytics
export { AnalyticsRepository, AnalyticsService } from './analytics/index.js'
export type { AppUserRow, CreateAppUserInput, UpdateAppUserInput } from './app-users/index.js'
// App Users
export { AppUserRepository, AppUserService } from './app-users/index.js'
export type { AutomationConfigRow, UpdateAutomationInput } from './automations/index.js'
// Automations
export { AutomationRepository, AutomationService } from './automations/index.js'
export type { BillingWebhookEvent, CheckoutSession, Subscription } from './billing/index.js'
// Billing
export { BillingService, StripeProvider } from './billing/index.js'
export { addSeconds, isExpired, now } from './common/date.js'
// Common utilities
export {
  buildPaginatedResponse,
  DEFAULT_PAGE,
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
  normalizePagination,
  paginationOffset,
} from './common/pagination.js'
export type { DeviceRow, RegisterDeviceInput } from './devices/index.js'
// Devices
export { DeviceRepository, DeviceService } from './devices/index.js'
export type { EncryptedCredential } from './encryption/service.js'
// Encryption
export { EncryptionService } from './encryption/service.js'
export {
  AppUserNotFoundError,
  AutomationNotFoundError,
  BillingError,
  DeviceNotFoundError,
  DomainError,
  EncryptionError,
  InvalidStatusTransitionError,
  MissingTenantIdError,
  NotificationLimitExceededError,
  NotificationNotFoundError,
  PushProviderError,
  TenantNotFoundError,
} from './errors.js'
export type {
  CreateNotificationInput,
  FlowDefinition,
  Notification,
  NotificationTemplate,
  PipelineContext,
  PipelineResult,
  PipelineStep,
  UpdateNotificationStatusInput,
} from './notifications/index.js'
// Notifications
export {
  boletoRecoveryFlow,
  boletoRecoveryTemplate,
  browseAbandonedFlow,
  browseAbandonedTemplate,
  cartAbandonedFlow,
  cartAbandonedTemplate,
  checkoutAbandonedFlow,
  checkoutAbandonedTemplate,
  executePipeline,
  NotificationRepository,
  NotificationService,
  orderConfirmedFlow,
  orderConfirmedTemplate,
  pipelineSteps,
  pixRecoveryFlow,
  pixRecoveryTemplate,
  trackingCreatedFlow,
  trackingCreatedTemplate,
  upsellFlow,
  upsellTemplate,
  welcomeFlow,
  welcomeTemplate,
} from './notifications/index.js'
export type {
  PushAppConfig,
  PushDeliveryStatus,
  PushNotificationPayload,
  PushProvider,
  PushResult,
} from './push/index.js'
// Push
export { OneSignalProvider, PushService } from './push/index.js'
export type {
  AnalyticsQueuePayload,
  DataIngestionPayload,
  PushDispatchPayload,
  QueueName,
} from './queues/index.js'

// Queues
export {
  analyticsQueue,
  dataIngestionQueue,
  pushDispatchQueue,
  queueNames,
} from './queues/index.js'
// Base Repository
export { BaseRepository } from './repositories/base.repository.js'
export type { CreateTenantInput, TenantRow, UpdateTenantInput } from './tenants/index.js'
// Tenants
export { TenantRepository, TenantService } from './tenants/index.js'
