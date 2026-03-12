import { importJWK, SignJWT } from 'jose'

const TEST_JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!'

/**
 * Creates a test JWK from a symmetric secret for signing JWTs.
 */
async function getSigningKey(secret?: string) {
  const key = new TextEncoder().encode(secret ?? TEST_JWT_SECRET)
  return await importJWK(
    {
      kty: 'oct',
      k: Buffer.from(key).toString('base64url'),
    },
    'HS256',
  )
}

export interface TestJwtPayload {
  sub?: string
  tenant_id?: string
  role?: string
  email?: string
  [key: string]: unknown
}

/**
 * Creates a valid JWT for testing purposes.
 *
 * @example
 * const jwt = await createTestJwt({ sub: 'user-1', tenant_id: 't-1' })
 */
export async function createTestJwt(
  payload: TestJwtPayload,
  options?: { secret?: string; expiresIn?: string },
): Promise<string> {
  const key = await getSigningKey(options?.secret)
  const builder = new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('appfy-test')

  if (options?.expiresIn !== 'none') {
    builder.setExpirationTime(options?.expiresIn ?? '1h')
  }

  return builder.sign(key)
}

/**
 * Creates a JWT scoped to a specific tenant with a role.
 *
 * @example
 * const jwt = await createTenantJwt('tenant-123', 'owner')
 */
export async function createTenantJwt(
  tenantId: string,
  role = 'editor',
  options?: { userId?: string; secret?: string },
): Promise<string> {
  const opts: { secret?: string; expiresIn?: string } = {}
  if (options?.secret) opts.secret = options.secret
  return createTestJwt(
    {
      sub: options?.userId ?? crypto.randomUUID(),
      tenant_id: tenantId,
      role,
    },
    opts,
  )
}

/**
 * Creates an expired JWT for testing token rejection.
 *
 * @example
 * const jwt = await createExpiredJwt({ sub: 'user-1' })
 */
export async function createExpiredJwt(payload?: TestJwtPayload, secret?: string): Promise<string> {
  const key = await getSigningKey(secret)
  return new SignJWT(payload ?? { sub: crypto.randomUUID() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .setIssuer('appfy-test')
    .sign(key)
}

/** The default secret used for test JWTs. Export for guard configuration. */
export const TEST_SECRET = TEST_JWT_SECRET
