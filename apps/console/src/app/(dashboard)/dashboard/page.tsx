'use client'

import { dashboardMetrics } from '@/lib/mock-data'
import { HeroMetric } from '@/components/features/dashboard/hero-metric'
import { MetricCard } from '@/components/features/dashboard/metric-card'
import { RevenueChart } from '@/components/features/dashboard/revenue-chart'
import { TopNotifications } from '@/components/features/dashboard/top-notifications'
import { SystemOverview } from '@/components/features/dashboard/system-overview'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visao geral da sua loja</p>
      </div>

      {/* Hero Metric */}
      <HeroMetric
        label="Receita gerada por push"
        valueInCents={dashboardMetrics.revenue}
        changePercent={dashboardMetrics.revenueChange}
      />

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Push Enviados"
          value={dashboardMetrics.sent.toLocaleString('pt-BR')}
          changePercent={dashboardMetrics.sentChange}
        />
        <MetricCard
          label="Taxa de Abertura"
          value={`${dashboardMetrics.openRate}%`}
          changePercent={dashboardMetrics.openRateChange}
        />
        <MetricCard
          label="Taxa de Cliques"
          value={`${dashboardMetrics.clickRate}%`}
          changePercent={dashboardMetrics.clickRateChange}
        />
        <MetricCard
          label="Taxa de Conversao"
          value={`${dashboardMetrics.conversionRate}%`}
          changePercent={dashboardMetrics.conversionRateChange}
        />
      </div>

      {/* Charts and Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueChart />
        <TopNotifications />
      </div>

      {/* System Overview */}
      <SystemOverview />
    </div>
  )
}
