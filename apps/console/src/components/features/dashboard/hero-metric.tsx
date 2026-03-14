'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeroMetricProps {
  label: string
  valueInCents: number
  changePercent: number
}

function formatBrl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}

export function HeroMetric({ label, valueInCents, changePercent }: HeroMetricProps) {
  const isPositive = changePercent >= 0

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-card p-8 neon-glow-lg">
      <div className="relative z-10">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">
          {formatBrl(valueInCents)}
        </p>
        <div className="mt-3 flex items-center gap-1.5">
          {isPositive ? (
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-400" />
          )}
          <span
            className={cn(
              'text-sm font-medium tabular-nums',
              isPositive ? 'text-emerald-400' : 'text-red-400',
            )}
          >
            {isPositive ? '+' : ''}
            {changePercent}%
          </span>
          <span className="text-sm text-muted-foreground">vs. mes anterior</span>
        </div>
      </div>
      {/* Decorative gradient */}
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />
    </div>
  )
}
