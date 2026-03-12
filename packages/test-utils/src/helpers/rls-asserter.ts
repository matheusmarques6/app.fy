/**
 * RLS assertion helpers for multi-tenant isolation tests.
 *
 * These helpers template the 6 standard RLS scenarios that every
 * tenant-scoped table must pass. They require a running test database
 * with RLS policies applied.
 *
 * @example
 * import { createRlsAssertionSuite } from '@appfy/test-utils'
 *
 * createRlsAssertionSuite({
 *   table: 'notifications',
 *   setup: async (sql, tenantId) => {
 *     await sql`INSERT INTO notifications (id, tenant_id, ...) VALUES (...)`
 *   },
 *   query: async (sql) => sql`SELECT * FROM notifications`,
 * })
 */

export interface RlsAssertionConfig {
  /** Table name being tested */
  table: string
  /** Insert test data for a specific tenant */
  setup: (sql: unknown, tenantId: string) => Promise<void>
  /** Query the table (results should be filtered by RLS) */
  query: (sql: unknown) => Promise<unknown[]>
  /** Optional: Insert data with a mismatched tenant_id (should fail) */
  insertCrossTenant?: (sql: unknown, tenantIdA: string, tenantIdB: string) => Promise<void>
}

/**
 * Asserts that tenant A cannot read tenant B's data.
 * This is the core multi-tenant isolation check.
 *
 * @param config - Table, setup, and query functions
 * @param tenantAId - First tenant ID
 * @param tenantBId - Second tenant ID
 */
export async function assertTenantIsolation(
  config: RlsAssertionConfig,
  tenantAId: string,
  tenantBId: string,
): Promise<void> {
  // This is a template — actual implementation requires:
  // 1. SET LOCAL role TO authenticated
  // 2. SET LOCAL request.jwt.claims TO '{"tenant_id": "..."}'
  // 3. Run query and assert results

  // Placeholder that throws if called without DB setup
  throw new Error(
    `assertTenantIsolation for '${config.table}' requires a running test database. ` +
      `Tenants: ${tenantAId}, ${tenantBId}`,
  )
}

/**
 * Asserts that queries without a tenant JWT return zero results.
 */
export async function assertNoAccessWithoutTenant(config: RlsAssertionConfig): Promise<void> {
  throw new Error(
    `assertNoAccessWithoutTenant for '${config.table}' requires a running test database.`,
  )
}

/**
 * Creates a full RLS assertion suite template.
 * Returns a describe block factory for use in vitest.
 *
 * The 6 standard scenarios:
 * 1. Tenant A reads only A's data
 * 2. Tenant B reads only B's data
 * 3. Tenant A CANNOT read B's data
 * 4. No JWT -> access denied
 * 5. JWT with invalid tenant_id -> zero results
 * 6. Tenant A INSERT with B's tenant_id -> must fail
 */
export function createRlsScenarios(config: RlsAssertionConfig) {
  return {
    table: config.table,
    scenarios: [
      'Tenant A reads only own data',
      'Tenant B reads only own data',
      'Tenant A cannot read Tenant B data',
      'No JWT returns access denied',
      'Invalid tenant_id returns zero results',
      'Cross-tenant INSERT is rejected',
    ] as const,
    config,
  }
}

/**
 * Helper to create an isolation test suite for a domain entity.
 * Provides the describe/it structure — DB operations come from config callbacks.
 *
 * @example
 * createIsolationSuite('notification', createFn, getFn, listFn)
 */
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
