/**
 * RLS assertion helpers for multi-tenant isolation tests.
 *
 * These helpers provide utilities to test RLS policies by simulating
 * JWT claims via `set_config('request.jwt.claims', ...)` and switching
 * the PostgreSQL role to `authenticated`.
 *
 * Requires the RLS migration (0001_rls_policies.sql) to be applied,
 * which creates the auth schema, auth.jwt() function, and the
 * authenticated/anon roles.
 */

export interface RlsTestContext {
  /** Raw postgres.js SQL tagged template */
  sql: unknown
}

export interface RlsAssertionConfig {
  table: string
  setup: (sql: unknown, tenantId: string) => Promise<void>
  query: (sql: unknown) => Promise<unknown[]>
  insertCrossTenant?: (sql: unknown, tenantIdA: string, tenantIdB: string) => Promise<void>
}

/**
 * Execute a function within a transaction that simulates an authenticated
 * user with specific JWT claims (tenant_id + sub).
 *
 * Usage with postgres.js:
 * ```ts
 * import postgres from 'postgres'
 * const sql = postgres(DATABASE_URL)
 *
 * const rows = await withTenantJwt(sql, tenantId, userId, async (tx) => {
 *   return tx`SELECT * FROM notifications`
 * })
 * ```
 */
export async function withTenantJwt<T>(
  // biome-ignore lint/suspicious/noExplicitAny: postgres.js types are complex
  sql: any,
  tenantId: string,
  userId: string,
  fn: (tx: unknown) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx: unknown) => {
    const claims = JSON.stringify({ sub: userId, tenant_id: tenantId })
    // biome-ignore lint/suspicious/noExplicitAny: raw SQL template
    const txAny = tx as any
    await txAny`SELECT set_config('request.jwt.claims', ${claims}, true)`
    await txAny`SET LOCAL ROLE authenticated`
    return fn(tx)
  })
}

/**
 * Execute a function as an authenticated user WITHOUT JWT claims.
 * Used to test Scenario 4: "No JWT -> access denied".
 */
export async function withoutJwt<T>(
  // biome-ignore lint/suspicious/noExplicitAny: postgres.js types are complex
  sql: any,
  fn: (tx: unknown) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx: unknown) => {
    // biome-ignore lint/suspicious/noExplicitAny: raw SQL template
    const txAny = tx as any
    await txAny`SELECT set_config('request.jwt.claims', '{}', true)`
    await txAny`SET LOCAL ROLE authenticated`
    return fn(tx)
  })
}

/**
 * Verify that RLS is enabled on a table by checking pg_class.
 *
 * Usage:
 * ```ts
 * const enabled = await isRlsEnabled(sql, 'notifications')
 * expect(enabled).toBe(true)
 * ```
 */
export async function isRlsEnabled(
  // biome-ignore lint/suspicious/noExplicitAny: postgres.js types are complex
  sql: any,
  tableName: string,
): Promise<boolean> {
  const rows = await sql`
    SELECT relrowsecurity
    FROM pg_class
    WHERE relname = ${tableName}
  `
  return rows[0]?.relrowsecurity === true
}

/**
 * Get all RLS policies for a table.
 */
export async function getPoliciesForTable(
  // biome-ignore lint/suspicious/noExplicitAny: postgres.js types are complex
  sql: any,
  tableName: string,
): Promise<Array<{ policyname: string; cmd: string; permissive: string }>> {
  return sql`
    SELECT policyname, cmd, permissive
    FROM pg_policies
    WHERE tablename = ${tableName}
    ORDER BY policyname
  `
}

export function createRlsScenarios(config: RlsAssertionConfig) {
  return {
    table: config.table,
    scenarios: [
      'Tenant A reads only own data',
      'Tenant B reads only own data',
      'Tenant A cannot read Tenant B data',
      'No JWT returns zero rows',
      'Invalid tenant_id returns zero results',
      'Cross-tenant INSERT is rejected',
    ] as const,
    config,
  }
}

export function createIsolationSuite(
  entityName: string,
  _createFn: (tenantId: string) => Promise<{ id: string }>,
  _getFn: (tenantId: string, id: string) => Promise<unknown>,
  _listFn: (tenantId: string) => Promise<unknown[]>,
) {
  return {
    entityName,
    scenarios: [
      `${entityName}: create in tenant A, invisible to tenant B`,
      `${entityName}: list returns only own tenant data`,
      `${entityName}: get by ID from wrong tenant returns undefined`,
    ] as const,
  }
}
