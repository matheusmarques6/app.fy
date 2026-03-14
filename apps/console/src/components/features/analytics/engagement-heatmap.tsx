'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { engagementHeatmap } from '@/lib/mock-data'

const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

function getColor(value: number): string {
  if (value > 80) return 'bg-violet-500'
  if (value > 60) return 'bg-violet-500/70'
  if (value > 40) return 'bg-violet-500/40'
  if (value > 20) return 'bg-violet-500/20'
  return 'bg-white/5'
}

export function EngagementHeatmap() {
  const grid = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => {
      const cell = engagementHeatmap.find((c) => c.day === day && c.hour === hour)
      return cell?.value ?? 0
    }),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Engajamento por Horario</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="flex">
              <div className="w-10" />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground">
                  {h}
                </div>
              ))}
            </div>
            {/* Grid */}
            {grid.map((row, dayIndex) => (
              <div key={dayIndex} className="flex items-center gap-0.5 mt-0.5">
                <span className="w-10 text-xs text-muted-foreground">{dayLabels[dayIndex]}</span>
                {row.map((value, hourIndex) => (
                  <div
                    key={hourIndex}
                    className={`flex-1 h-5 rounded-sm ${getColor(value)} transition-colors`}
                    title={`${dayLabels[dayIndex]} ${hourIndex}h: ${value} interacoes`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* Legend */}
        <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span>Menos</span>
          <div className="flex gap-0.5">
            {['bg-white/5', 'bg-violet-500/20', 'bg-violet-500/40', 'bg-violet-500/70', 'bg-violet-500'].map((color) => (
              <div key={color} className={`h-3 w-3 rounded-sm ${color}`} />
            ))}
          </div>
          <span>Mais</span>
        </div>
      </CardContent>
    </Card>
  )
}
