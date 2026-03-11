import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.js'

export type Database = ReturnType<typeof createDrizzleClient>

export function createDrizzleClient(connectionUrl: string) {
  const client = postgres(connectionUrl)
  return drizzle(client, { schema })
}
