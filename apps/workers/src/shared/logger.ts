type LogLevel = 'info' | 'warn' | 'error'

interface LogMeta {
  [key: string]: unknown
}

export interface Logger {
  info: (message: string, meta?: LogMeta) => void
  warn: (message: string, meta?: LogMeta) => void
  error: (message: string, meta?: LogMeta) => void
}

function log(level: LogLevel, service: string, message: string, meta?: LogMeta): void {
  const entry = JSON.stringify({
    level,
    service,
    message,
    ...meta,
    timestamp: new Date().toISOString(),
  })

  switch (level) {
    case 'error':
      console.error(entry)
      break
    case 'warn':
      console.warn(entry)
      break
    default:
      console.info(entry)
  }
}

/**
 * Creates a logger instance with a service identifier included in every log line.
 * Useful for distinguishing which worker emitted a log when logs are aggregated.
 */
export function createLogger(service: string): Logger {
  return {
    info: (message: string, meta?: LogMeta) => log('info', service, message, meta),
    warn: (message: string, meta?: LogMeta) => log('warn', service, message, meta),
    error: (message: string, meta?: LogMeta) => log('error', service, message, meta),
  }
}

/** Default logger for shared modules that don't have a specific service context */
export const logger = createLogger('worker')
