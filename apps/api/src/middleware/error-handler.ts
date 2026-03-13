import { DomainError } from '@appfy/core'
import type { ApiErrorResponse } from '@appfy/shared'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { HTTPException } from 'hono/http-exception'

/** Maps DomainError codes to HTTP status codes */
function domainErrorToStatus(error: DomainError): ContentfulStatusCode {
  const code = error.code

  // 404 — Not Found
  if (
    code === 'TENANT_NOT_FOUND' ||
    code === 'NOTIFICATION_NOT_FOUND' ||
    code === 'APP_USER_NOT_FOUND' ||
    code === 'DEVICE_NOT_FOUND' ||
    code === 'AUTOMATION_NOT_FOUND'
  ) {
    return 404
  }

  // 400 — Validation / Bad Request
  if (
    code === 'INVALID_STATUS_TRANSITION' ||
    code === 'MISSING_TENANT_ID'
  ) {
    return 400
  }

  // 403 — Forbidden / Limit
  if (code === 'NOTIFICATION_LIMIT_EXCEEDED') {
    return 403
  }

  // 422 — Unprocessable Entity (generic domain error)
  return 422
}

/** Global error handler middleware */
export function errorHandler(err: Error, c: Context): Response {
  // Hono HTTP exceptions (from middleware like auth)
  if (err instanceof HTTPException) {
    const body: ApiErrorResponse = {
      error: {
        code: 'HTTP_ERROR',
        message: err.message,
      },
    }
    return c.json(body, err.status)
  }

  // Domain errors from core services
  if (err instanceof DomainError) {
    const status = domainErrorToStatus(err)
    const body: ApiErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
      },
    }
    return c.json(body, status)
  }

  // Unknown errors — 500
  console.error(
    JSON.stringify({
      level: 'error',
      message: 'Unhandled error',
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    }),
  )

  const body: ApiErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  }
  return c.json(body, 500)
}
