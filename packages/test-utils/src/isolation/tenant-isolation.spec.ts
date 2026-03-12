/**
 * Multi-tenant isolation test templates.
 *
 * These tests verify that data created by Tenant A is invisible to Tenant B.
 * They require a running test database — run with:
 *   docker-compose -f docker-compose.test.yml up
 *
 * To use: implement the createFn/getFn/listFn callbacks for each entity
 * and uncomment the test blocks.
 */
import { describe, it } from 'vitest'

const TENANT_A = 'tenant-a-isolation'
const TENANT_B = 'tenant-b-isolation'

describe.todo('Tenant Isolation: notifications', () => {
  it.todo(`Tenant A creates notification, Tenant B cannot see it`)
  it.todo(`Tenant B creates notification, Tenant A cannot see it`)
  it.todo(`list() returns only own tenant notifications`)
  it.todo(`findById() with wrong tenant returns undefined`)
})

describe.todo('Tenant Isolation: devices', () => {
  it.todo(`Tenant A device is invisible to Tenant B`)
  it.todo(`findActiveByUser() is tenant-scoped`)
})

describe.todo('Tenant Isolation: app_users', () => {
  it.todo(`Tenant A user is invisible to Tenant B`)
  it.todo(`list() returns only own tenant users`)
})

describe.todo('Tenant Isolation: deliveries', () => {
  it.todo(`Delivery created by Tenant A is invisible to Tenant B`)
  it.todo(`listByNotification() is tenant-scoped`)
})

describe.todo('Tenant Isolation: automation_configs', () => {
  it.todo(`Automation created by Tenant A is invisible to Tenant B`)
  it.todo(`listByTenant() returns only own configs`)
})

describe.todo('Tenant Isolation: app_events', () => {
  it.todo(`Event created by Tenant A is invisible to Tenant B`)
  it.todo(`listByUser() is tenant-scoped`)
})

// Template for implementing isolation tests:
//
// describe('Tenant Isolation: <entity>', () => {
//   beforeAll(async () => {
//     // Create test data for both tenants
//   })
//
//   it('Tenant A creates, Tenant B cannot see', async () => {
//     const item = await repo.create(TENANT_A, { ... })
//     const result = await repo.findById(TENANT_B, item.id)
//     expect(result).toBeUndefined()
//   })
//
//   it('list() returns only own tenant', async () => {
//     const listA = await repo.list(TENANT_A, { page: 1, perPage: 100 })
//     const listB = await repo.list(TENANT_B, { page: 1, perPage: 100 })
//     expect(listA.data.every(i => i.tenantId === TENANT_A)).toBe(true)
//     expect(listB.data.every(i => i.tenantId === TENANT_B)).toBe(true)
//   })
// })

export { TENANT_A, TENANT_B }
