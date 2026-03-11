import { describe, expect, it } from 'vitest'

import { planNames, plans } from './plans.js'

describe('plans', () => {
  it('should have 3 plan names', () => {
    expect(planNames).toHaveLength(3)
    expect(planNames).toEqual(['starter', 'business', 'elite'])
  })

  it('starter should have 15 manual notifications limit', () => {
    expect(plans.starter.manualNotificationsPerMonth).toBe(15)
  })

  it('business and elite should have unlimited manual notifications', () => {
    expect(plans.business.manualNotificationsPerMonth).toBeNull()
    expect(plans.elite.manualNotificationsPerMonth).toBeNull()
  })

  it('all plans should have unlimited automated notifications', () => {
    for (const name of planNames) {
      expect(plans[name].unlimitedAutomated).toBe(true)
    }
  })

  it('prices should be in cents', () => {
    expect(plans.starter.priceInCents).toBe(12700)
    expect(plans.business.priceInCents).toBe(19700)
    expect(plans.elite.priceInCents).toBe(29700)
  })
})
