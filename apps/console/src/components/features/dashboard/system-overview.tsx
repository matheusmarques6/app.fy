'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Zap, Smartphone } from 'lucide-react'
import { dashboardMetrics } from '@/lib/mock-data'

export function SystemOverview() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/20">
            <Zap className="h-6 w-6 text-violet-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Automacoes Ativas</p>
            <p className="text-2xl font-bold tabular-nums">
              {dashboardMetrics.activeAutomations}/{dashboardMetrics.totalAutomations}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20">
            <Smartphone className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status do App</p>
            <Badge variant="success" className="mt-1">
              {dashboardMetrics.appStatus === 'published' ? 'Publicado' : dashboardMetrics.appStatus}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
