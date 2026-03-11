import { createDrizzleClient } from './client.js'

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/appfy_test'

export function createTestClient() {
  return createDrizzleClient(TEST_DATABASE_URL)
}
