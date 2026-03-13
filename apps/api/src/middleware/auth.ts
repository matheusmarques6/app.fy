import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import * as jose from 'jose'
import { env } from '../env.js'

/** Extracts and verifies JWT from Authorization Bearer header */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authorization = c.req.header('Authorization')
  if (!authorization) {
    throw new HTTPException(401, { message: 'Missing Authorization header' })
  }

  const parts = authorization.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new HTTPException(401, { message: 'Invalid Authorization format. Expected: Bearer <token>' })
  }

  const token = parts[1]!

  try {
    const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
    const { payload } = await jose.jwtVerify(token, secret, { algorithms: ['HS256'] })

    const userId = payload.sub
    if (!userId) {
      throw new HTTPException(401, { message: 'Invalid token: missing sub claim' })
    }

    c.set('userId', userId)
    await next()
  } catch (err) {
    if (err instanceof HTTPException) {
      throw err
    }
    if (err instanceof jose.errors.JWTExpired) {
      throw new HTTPException(401, { message: 'Token expired' })
    }
    throw new HTTPException(401, { message: 'Invalid token' })
  }
}
