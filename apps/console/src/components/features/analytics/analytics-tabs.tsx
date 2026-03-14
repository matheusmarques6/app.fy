'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FunnelChart } from './funnel-chart'
import { RevenueByFlow } from './revenue-by-flow'
import { EngagementHeatmap } from './engagement-heatmap'
import { PlatformDistribution } from './platform-distribution'
import { ActiveUsersChart } from './active-users-chart'
import { KpiCards } from './kpi-cards'

export function AnalyticsTabs() {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Visao Geral</TabsTrigger>
        <TabsTrigger value="notifications">Por Notificacao</TabsTrigger>
        <TabsTrigger value="flows">Por Flow</TabsTrigger>
        <TabsTrigger value="events">Eventos</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6 mt-6">
        <KpiCards />
        <div className="grid gap-6 lg:grid-cols-2">
          <FunnelChart />
          <PlatformDistribution />
        </div>
        <ActiveUsersChart />
      </TabsContent>

      <TabsContent value="notifications" className="space-y-6 mt-6">
        <FunnelChart />
        <EngagementHeatmap />
      </TabsContent>

      <TabsContent value="flows" className="space-y-6 mt-6">
        <RevenueByFlow />
      </TabsContent>

      <TabsContent value="events" className="space-y-6 mt-6">
        <ActiveUsersChart />
        <EngagementHeatmap />
      </TabsContent>
    </Tabs>
  )
}
