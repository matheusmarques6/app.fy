'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { NotificationRow } from '@/types'

interface DeliveryFunnelProps {
  notification: NotificationRow
}

export function DeliveryFunnel({ notification }: DeliveryFunnelProps) {
  const stages = [
    { label: 'Enviados', value: notification.sentCount, color: 'bg-violet-500' },
    { label: 'Entregues', value: notification.deliveredCount, color: 'bg-blue-500' },
    { label: 'Abertos', value: notification.openedCount, color: 'bg-cyan-500' },
    { label: 'Clicados', value: notification.clickedCount, color: 'bg-amber-500' },
    { label: 'Convertidos', value: notification.convertedCount, color: 'bg-emerald-500' },
  ]

  const maxValue = notification.sentCount || 1

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Funil de Entrega</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stages.map((stage) => {
          const percentage = maxValue > 0 ? (stage.value / maxValue) * 100 : 0
          return (
            <div key={stage.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{stage.label}</span>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums font-medium">{stage.value.toLocaleString('pt-BR')}</span>
                  <span className="tabular-nums text-xs text-muted-foreground">({percentage.toFixed(1)}%)</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full ${stage.color} transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
