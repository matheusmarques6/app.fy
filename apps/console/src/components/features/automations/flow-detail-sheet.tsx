'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import type { AutomationFlow } from '@/types'

interface FlowDetailSheetProps {
  flow: AutomationFlow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDelay(seconds: number): string {
  if (seconds === 0) return 'Imediato'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutos`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} horas`
  return `${Math.floor(seconds / 86400)} dias`
}

export function FlowDetailSheet({ flow, open, onOpenChange }: FlowDetailSheetProps) {
  if (!flow) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{flow.title}</SheetTitle>
          <SheetDescription>{flow.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between">
            <Label>Status</Label>
            <div className="flex items-center gap-2">
              <Badge variant={flow.isEnabled ? 'success' : 'secondary'}>
                {flow.isEnabled ? 'Ativo' : 'Inativo'}
              </Badge>
              <Switch checked={flow.isEnabled} />
            </div>
          </div>

          <Separator />

          {/* Delay */}
          <div className="space-y-2">
            <Label>Delay</Label>
            <p className="text-sm text-muted-foreground">{formatDelay(flow.delaySeconds)}</p>
          </div>

          <Separator />

          {/* Template */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Template</Label>
            <div className="space-y-2">
              <Label htmlFor="template-title">Titulo</Label>
              <Input id="template-title" defaultValue={flow.templateTitle} />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {['{{product_name}}', '{{store_name}}', '{{order_id}}'].map((chip) => (
                  <Badge key={chip} variant="outline" className="cursor-pointer text-xs hover:bg-violet-500/20">
                    {chip}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-body">Mensagem</Label>
              <textarea
                id="template-body"
                className="flex min-h-[100px] w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                defaultValue={flow.templateBody}
              />
            </div>
          </div>

          <Separator />

          {/* Metrics */}
          {flow.sentCount > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Metricas</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="text-xs text-muted-foreground">Enviados</p>
                  <p className="text-xl font-bold tabular-nums">{flow.sentCount.toLocaleString('pt-BR')}</p>
                </div>
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="text-xs text-muted-foreground">Conversao</p>
                  <p className="text-xl font-bold tabular-nums text-emerald-400">{flow.conversionRate}%</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button className="flex-1">Salvar</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
