'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string
  changePercent: number
  changeLabel?: string
}

export function MetricCard({ label, value, changePercent, changeLabel = 'vs. mes anterior' }: MetricCardProps) {
  const isPositive = changePercent >= 0

  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
        <div className="mt-2 flex items-center gap-1">
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-red-400" />
          )}
          <span
            className={cn(
              'text-xs font-medium tabular-nums',
              isPositive ? 'text-emerald-400' : 'text-red-400',
            )}
          >
            {isPositive ? '+' : ''}
            {changePercent}%
          </span>
          <span className="text-xs text-muted-foreground">{changeLabel}</span>
        </div>
      </CardContent>
    </Card>
  )
}
