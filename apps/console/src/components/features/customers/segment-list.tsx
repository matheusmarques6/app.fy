'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'
import { segments } from '@/lib/mock-data'

export function SegmentList() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {segments.map((segment) => (
        <Card key={segment.id}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20">
                  <Users className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <h3 className="font-semibold">{segment.name}</h3>
                  <p className="text-xs text-muted-foreground">{segment.description}</p>
                </div>
              </div>
              <Badge variant="outline" className="tabular-nums">
                {segment.memberCount.toLocaleString('pt-BR')} membros
              </Badge>
            </div>

            {/* Rules visualization */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {segment.rules.conditions.map((condition, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {condition.field} {condition.op} {String(condition.value)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
