'use client'

import { Card, CardContent } from '@/components/ui/card'
import { analyticsKpis } from '@/lib/mock-data'

export function KpiCards() {
  const kpis = [
    { label: 'Opt-in Push', value: `${analyticsKpis.optInRate}%`, description: 'Usuarios com push ativo' },
    { label: 'Retencao 7d', value: `${analyticsKpis.retentionD7}%`, description: 'Retorno apos 7 dias' },
    { label: 'Retencao 30d', value: `${analyticsKpis.retentionD30}%`, description: 'Retorno apos 30 dias' },
    { label: 'Tempo Medio Sessao', value: `${Math.floor(analyticsKpis.avgSessionDuration / 60)}:${String(analyticsKpis.avgSessionDuration % 60).padStart(2, '0')}`, description: 'Minutos por sessao' },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{kpi.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{kpi.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
