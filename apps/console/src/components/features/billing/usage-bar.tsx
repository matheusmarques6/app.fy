'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface UsageBarProps {
  sent: number
  limit: number | null
}

export function UsageBar({ sent, limit }: UsageBarProps) {
  const isUnlimited = limit === null
  const percentage = isUnlimited ? 0 : Math.min((sent / limit) * 100, 100)

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Notificacoes Manuais</p>
          <p className="text-sm tabular-nums text-muted-foreground">
            {sent} / {isUnlimited ? 'Ilimitado' : limit}
          </p>
        </div>
        {isUnlimited ? (
          <div className="h-3 w-full rounded-full bg-emerald-500/20">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 animate-glow-pulse" />
          </div>
        ) : (
          <Progress value={percentage} />
        )}
        {!isUnlimited && percentage >= 80 && (
          <p className="mt-2 text-xs text-amber-400">
            Voce esta proximo do limite. Considere fazer upgrade.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
