'use client'

import { Badge } from '@/components/ui/badge'
import type { PlanName } from '@appfy/shared'

const planColors: Record<PlanName, string> = {
  starter: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  business: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  elite: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

const planLabels: Record<PlanName, string> = {
  starter: 'Starter',
  business: 'Business',
  elite: 'Elite',
}

interface PlanBadgeProps {
  plan: PlanName
}

export function PlanBadge({ plan }: PlanBadgeProps) {
  return (
    <Badge className={`text-sm px-3 py-1 ${planColors[plan]}`}>
      {planLabels[plan]}
    </Badge>
  )
}
