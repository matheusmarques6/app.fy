'use client'

import { AnalyticsTabs } from '@/components/features/analytics/analytics-tabs'

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Metricas e performance das suas notificacoes</p>
      </div>

      <AnalyticsTabs />
    </div>
  )
}
