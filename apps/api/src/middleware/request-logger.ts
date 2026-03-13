import type { MiddlewareHandler } from 'hono'

/** Structured JSON request logger */
export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = performance.now()
  const method = c.req.method
  const path = c.req.path

  await next()

  const duration = Math.round(performance.now() - start)
  const status = c.res.status

  const log = {
    level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
    method,
    path,
    status,
    duration_ms: duration,
    timestamp: new Date().toISOString(),
  }

  // Structured JSON logging (never console.log in prod)
  if (status >= 500) {
    console.error(JSON.stringify(log))
  } else if (status >= 400) {
    console.warn(JSON.stringify(log))
  } else {
    console.info(JSON.stringify(log))
  }
}
