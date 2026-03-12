/**
 * Test database setup/teardown helpers.
 *
 * Usage in vitest.config.ts:
 *   globalSetup: ['@appfy/test-utils/setup-db']
 *
 * Or in individual test files:
 *   import { setupTestDatabase, teardownTestDatabase } from '@appfy/test-utils'
 *   beforeAll(() => setupTestDatabase())
 *   afterAll(() => teardownTestDatabase())
 *
 * Requires TEST_DATABASE_URL env var pointing to the isolated test DB.
 */

let teardownFn: (() => Promise<void>) | null = null

export async function setupTestDatabase(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is required. Start test services with: docker-compose -f docker-compose.test.yml up',
    )
  }

  // Dynamic import to avoid hard dependency on postgres at module level
  // @ts-expect-error postgres may not be installed — it's a peer dependency
  const { default: postgres } = await import('postgres')
  // biome-ignore lint/suspicious/noExplicitAny: postgres driver type depends on runtime import
  const sql = (postgres as any)(url)

  // Verify connection
  await sql`SELECT 1`

  teardownFn = async () => {
    await sql.end()
  }
}

export async function teardownTestDatabase(): Promise<void> {
  if (teardownFn) {
    await teardownFn()
    teardownFn = null
  }
}

/**
 * Truncates all tables in the test database (excluding system tables).
 * Useful for resetting state between test suites.
 */
export async function cleanTestDatabase(sql: unknown): Promise<void> {
  // biome-ignore lint/suspicious/noExplicitAny: sql type depends on postgres driver
  const pg = sql as any
  const tables = await pg`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE '_drizzle%'
  `
  for (const { tablename } of tables) {
    await pg`TRUNCATE TABLE ${pg(tablename)} CASCADE`
  }
}
