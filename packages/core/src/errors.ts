/** Base domain error — all domain-specific errors extend this */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

export class TenantNotFoundError extends DomainError {
  constructor(tenantId: string) {
    super(`Tenant not found: ${tenantId}`, 'TENANT_NOT_FOUND')
  }
}

export class NotificationLimitExceededError extends DomainError {
  constructor(tenantId: string, limit: number) {
    super(
      `Notification limit (${limit}) exceeded for tenant: ${tenantId}`,
      'NOTIFICATION_LIMIT_EXCEEDED',
    )
  }
}

export class InvalidStatusTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(`Invalid status transition from '${from}' to '${to}'`, 'INVALID_STATUS_TRANSITION')
  }
}

export class AppUserNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`App user not found: ${identifier}`, 'APP_USER_NOT_FOUND')
  }
}

export class DeviceNotFoundError extends DomainError {
  constructor(deviceId: string) {
    super(`Device not found: ${deviceId}`, 'DEVICE_NOT_FOUND')
  }
}

export class AutomationNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`Automation config not found: ${identifier}`, 'AUTOMATION_NOT_FOUND')
  }
}

export class EncryptionError extends DomainError {
  constructor(message: string) {
    super(message, 'ENCRYPTION_ERROR')
  }
}

export class PushProviderError extends DomainError {
  constructor(provider: string, message: string) {
    super(`Push provider [${provider}] error: ${message}`, 'PUSH_PROVIDER_ERROR')
  }
}

export class NotificationNotFoundError extends DomainError {
  constructor(notificationId: string) {
    super(`Notification not found: ${notificationId}`, 'NOTIFICATION_NOT_FOUND')
  }
}

export class BillingError extends DomainError {
  constructor(message: string) {
    super(message, 'BILLING_ERROR')
  }
}

export class MissingTenantIdError extends DomainError {
  constructor() {
    super('tenantId is required for all repository operations', 'MISSING_TENANT_ID')
  }
}
