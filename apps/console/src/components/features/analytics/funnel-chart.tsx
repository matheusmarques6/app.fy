'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { analyticsFunnel } from '@/lib/mock-data'

export function FunnelChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Funil de Performance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {analyticsFunnel.map((stage, index) => {
          const widthPct = stage.percentage
          return (
            <div key={stage.stage} className="flex items-center gap-4">
              <span className="w-24 text-sm text-muted-foreground shrink-0">{stage.stage}</span>
              <div className="flex-1">
                <div className="h-8 w-full rounded-lg bg-white/5">
                  <div
                    className="flex h-full items-center justify-end rounded-lg px-3 text-xs font-medium transition-all"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: [
                        'rgba(168, 85, 247, 0.6)',
                        'rgba(59, 130, 246, 0.6)',
                        'rgba(6, 182, 212, 0.6)',
                        'rgba(245, 158, 11, 0.6)',
                        'rgba(34, 197, 94, 0.6)',
                      ][index],
                    }}
                  >
                    <span className="tabular-nums">{stage.value.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              </div>
              <span className="w-14 text-right text-sm tabular-nums text-muted-foreground">{stage.percentage}%</span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
