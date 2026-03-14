'use client'

import { FlowGrid } from '@/components/features/automations/flow-grid'

export default function AutomationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Automacoes</h1>
        <p className="text-muted-foreground">Configure seus 9 fluxos de push automatizado</p>
      </div>

      <FlowGrid />
    </div>
  )
}
