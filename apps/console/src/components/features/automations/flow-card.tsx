'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  ShoppingCart,
  QrCode,
  FileText,
  PartyPopper,
  CreditCard,
  CheckCircle,
  Truck,
  Eye,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import type { AutomationFlow } from '@/types'

const flowIcons: Record<string, LucideIcon> = {
  cart_abandoned: ShoppingCart,
  pix_recovery: QrCode,
  boleto_recovery: FileText,
  welcome: PartyPopper,
  checkout_abandoned: CreditCard,
  order_confirmed: CheckCircle,
  tracking_created: Truck,
  browse_abandoned: Eye,
  upsell: TrendingUp,
}

interface FlowCardProps {
  flow: AutomationFlow
  onToggle: (id: string) => void
  onClick: (flow: AutomationFlow) => void
}

function formatDelay(seconds: number): string {
  if (seconds === 0) return 'Imediato'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

export function FlowCard({ flow, onToggle, onClick }: FlowCardProps) {
  const Icon = flowIcons[flow.flowType] ?? TrendingUp

  return (
    <Card
      className={`cursor-pointer transition-all hover:border-white/10 ${flow.isEnabled ? 'border-violet-500/20' : ''}`}
      onClick={() => onClick(flow)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20">
            <Icon className="h-5 w-5 text-violet-400" />
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={flow.isEnabled}
              onCheckedChange={() => onToggle(flow.id)}
            />
          </div>
        </div>

        <h3 className="mt-3 font-semibold">{flow.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{flow.description}</p>

        <div className="mt-4 flex items-center gap-3">
          <Badge variant={flow.isEnabled ? 'success' : 'secondary'}>
            {flow.isEnabled ? 'Ativo' : 'Inativo'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Delay: {formatDelay(flow.delaySeconds)}
          </span>
        </div>

        {flow.sentCount > 0 && (
          <div className="mt-3 flex items-center gap-4 border-t border-white/5 pt-3">
            <div>
              <p className="text-xs text-muted-foreground">Enviados</p>
              <p className="text-sm font-medium tabular-nums">{flow.sentCount.toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Conversao</p>
              <p className="text-sm font-medium tabular-nums text-emerald-400">{flow.conversionRate}%</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
