'use client'

import { IntegrationGrid } from '@/components/features/integrations/integration-grid'

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integracoes</h1>
        <p className="text-muted-foreground">Gerencie suas conexoes com plataformas externas</p>
      </div>

      <IntegrationGrid />
    </div>
  )
}
