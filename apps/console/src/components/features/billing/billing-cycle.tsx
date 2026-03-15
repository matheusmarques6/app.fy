'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Calendar } from 'lucide-react'

interface BillingCycleProps {
  nextDate: string
  amountInCents: number
}

function formatBrl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export function BillingCycle({ nextDate, amountInCents }: BillingCycleProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20">
            <Calendar className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Proxima cobranca</p>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold tabular-nums">{formatBrl(amountInCents)}</p>
              <span className="text-sm text-muted-foreground">
                em {new Date(nextDate).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
