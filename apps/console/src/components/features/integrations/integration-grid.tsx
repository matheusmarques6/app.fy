'use client'

import { integrations } from '@/lib/mock-data'
import { IntegrationCard } from './integration-card'

export function IntegrationGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {integrations.map((integration) => (
        <IntegrationCard key={integration.id} integration={integration} />
      ))}
    </div>
  )
}
