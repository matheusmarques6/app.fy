import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.js'

export type Database = ReturnType<typeof createPooledClient>

/**
 * Pooled client for API (Supabase pgBouncer transaction mode, port 6543).
 * `prepare: false` is required — pgBouncer transaction mode doesn't support prepared statements.
 */
export function createPooledClient(connectionUrl: string) {
  const client = postgres(connectionUrl, { prepare: false })
  return drizzle(client, { schema })
}

/**
 * Direct client for Workers and migrations (port 5432).
 * Keeps `prepare: true` (default) for query plan caching on long-lived connections.
 */
export function createDirectClient(connectionUrl: string) {
  const client = postgres(connectionUrl)
  return drizzle(client, { schema })
}

/**
 * @deprecated Use `createPooledClient` or `createDirectClient` instead.
 * Kept for backward compatibility — uses pooled mode (prepare: false).
 */
export function createDrizzleClient(connectionUrl: string) {
  return createPooledClient(connectionUrl)
}
