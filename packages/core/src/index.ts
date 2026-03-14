// Factory DI
export type { Dependencies, FactoryConfig } from './factory.js'
export { createDependencies } from './factory.js'

// App Configs
export type { AppConfigRow, UpdateAppConfigInput } from './app-configs/index.js'
export { AppConfigRepository, AppConfigService } from './app-configs/index.js'

// Audit
export type { AuditLogEntry, CreateAuditLogInput } from './audit/index.js'
export { AuditLogRepository, AuditLogService } from './audit/index.js'

// Credentials
export type { CredentialProvider, CredentialStoreDeps } from './credentials/index.js'
export { CredentialService } from './credentials/index.js'

// Security
export { SsrfError, validateUrl, isUrlAllowed } from './security/index.js'

// Domain Errors

export type {
  AnalyticsOverview,
  AnalyticsPeriod,
  FlowAnalytics,
  NotificationAnalytics,
  RevenueDataPoint,
  TopNotification,
} from './analytics/index.js'
// Analytics
export { AnalyticsRepository, AnalyticsService } from './analytics/index.js'
export type {
  AppUserRow,
  AppUserValidationInput,
  AppUserValidationResult,
  CreateAppUserInput,
  UpdateAppUserInput,
} from './app-users/index.js'
// App Users
export { AppUserRepository, AppUserService, isValidEmail, validateAppUserInput } from './app-users/index.js'
export type { AutomationConfigRow, AutomationJobPayload, QueueAdapter, UpdateAutomationInput } from './automations/index.js'
// Automations
export { AutomationRepository, AutomationService, AutomationTriggerService, DEFAULT_DELAYS } from './automations/index.js'
export type { BillingServiceDeps, BillingWebhookEvent, CheckoutSession, IdempotencyStore, PlanLimitCheckResult, PlanPriceRegistry, StripeCheckoutResult, StripeClient, StripeSubscription, Subscription } from './billing/index.js'
// Billing
export { BillingService, checkPlanLimit, InMemoryIdempotencyStore, PlanLimitService, StripeProvider } from './billing/index.js'
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
export type { MembershipRow } from './memberships/index.js'
// Memberships
export { MembershipRepository } from './memberships/index.js'
export type { AppEventRow, CreateEventInput, EventFilters, IngestEventInput } from './events/index.js'
export type { EventIngestionDeps, EventQueueAdapter, EventHistoryLookup, EventProcessorDeps } from './events/index.js'
// Events
export { EventRepository, EventIngestionService, EventProcessorService } from './events/index.js'
export {
  AppUserNotFoundError,
  AutomationNotFoundError,
  BillingError,
  DeliveryNotFoundError,
  DeviceNotFoundError,
  DomainError,
  EncryptionError,
  InvalidEventTypeError,
  InvalidStatusTransitionError,
  MissingTenantIdError,
  NotificationLimitExceededError,
  NotificationNotFoundError,
  PushProviderError,
  TenantNotFoundError,
} from './errors.js'
export type {
  DeliveryRecord,
  DeliveryStatusRepository,
  DeliveryStatusServiceDeps,
  FrequencyCappingCache,
  FrequencyCappingCheck,
  AttributableDelivery,
  AttributionRepository,
  ConversionAttributionResult,
} from './notifications/index.js'
export {
  DeliveryStatusService,
  FrequencyCappingService,
  ConversionAttributionService,
} from './notifications/index.js'
export type {
  AbTestConfig,
  AbTestResult,
  AbVariantConfig,
  AbVariantMetrics,
  AuditLogger,
  CreateNotificationInput,
  FlowDefinition,
  KnownVariable,
  Notification,
  NotificationServiceDeps,
  NotificationTemplate,
  PipelineContext,
  PipelineResult,
  PipelineStep,
  TemplateVariables,
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
  assertValidDeliveryTransition,
  assertValidTransition,
  calculateAbWinner,
  createDefaultSplit,
  executePipeline,
  extractVariables,
  getValidNextStatuses,
  isKnownVariable,
  isValidDeliveryTransition,
  isValidTransition,
  KNOWN_VARIABLES,
  NotificationRepository,
  NotificationService,
  renderTemplate,
  validateAbSplit,
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
export { DrizzleDeliveryRepository, OneSignalProvider, PushDispatchService, PushService } from './push/index.js'
export type {
  CreateDeliveryInput,
  DeliveryRepository,
  DeliveryRow,
  NotificationLookup,
  PushDispatchDeps,
  PushDispatchResult,
  TenantLookup,
} from './push/index.js'
export type {
  AnalyticsQueuePayload,
  BuildQueuePayload,
  DataIngestionPayload,
  PushDispatchPayload,
  QueueName,
} from './queues/index.js'

// Queues
export {
  analyticsQueue,
  buildQueue,
  dataIngestionQueue,
  pushDispatchQueue,
  queueNames,
} from './queues/index.js'
// Builds
export type { AppConfigLookup, BuildQueueAdapter, BuildServiceDeps, BuildStatus } from './builds/index.js'
export { BuildError, BuildService } from './builds/index.js'

// Base Repository
export { BaseRepository } from './repositories/base.repository.js'
export type {
  CreateSegmentInput,
  RefreshResult,
  RuleOperator,
  SegmentCondition,
  SegmentMembershipRow,
  SegmentRow,
  SegmentRuleGroup,
  UpdateSegmentInput,
  UserData,
} from './segments/index.js'
// Segments
export {
  evaluateCondition,
  evaluateSegmentRules,
  filterUsersByRules,
  isValidOperator,
  SegmentNotFoundError,
  SegmentRefreshService,
  SegmentRepository,
  SegmentService,
  validateSegmentRules,
} from './segments/index.js'
export type { CreateTenantInput, TenantRow, UpdateTenantInput } from './tenants/index.js'
// Tenants
export { TenantRepository, TenantService } from './tenants/index.js'
