import type { MiddlewareHandler } from 'hono'
import type { ZodSchema } from 'zod'

/**
 * Zod validation middleware for request body.
 * Parses the JSON body against the schema and sets validated data on context.
 * Returns 400 with error details on failure.
 *
 * Usage: app.post('/path', validate(mySchema), handler)
 */
export function validate(schema: ZodSchema): MiddlewareHandler {
  return async (c, next) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json(
        {
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON',
          },
        },
        400,
      )
    }

    const result = schema.safeParse(body)
    if (!result.success) {
      const details = result.error.flatten().fieldErrors
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details,
          },
        },
        400,
      )
    }

    c.set('validatedBody' as never, result.data as never)
    await next()
    return undefined
  }
}
