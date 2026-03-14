'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { customers } from '@/lib/mock-data'

interface CustomerDrawerProps {
  customerId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatBrl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

const mockTimeline = [
  { event: 'purchase_completed', detail: 'Compra de R$ 189,90', time: '2h atras' },
  { event: 'push_clicked', detail: 'Clicou em "Seu carrinho te espera"', time: '3h atras' },
  { event: 'push_opened', detail: 'Abriu push de Carrinho Abandonado', time: '3h atras' },
  { event: 'add_to_cart', detail: 'Adicionou "Camiseta Premium" ao carrinho', time: '5h atras' },
  { event: 'product_viewed', detail: 'Visualizou "Camiseta Premium"', time: '5h atras' },
  { event: 'app_opened', detail: 'Abriu o app', time: '5h atras' },
]

export function CustomerDrawer({ customerId, open, onOpenChange }: CustomerDrawerProps) {
  const customer = customers.find((c) => c.id === customerId)
  if (!customer) return null

  const initials = customer.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-sm">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle>{customer.name}</SheetTitle>
              <SheetDescription>{customer.email}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-muted-foreground">Gasto Total</p>
              <p className="text-lg font-bold tabular-nums">{formatBrl(customer.totalSpent)}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-muted-foreground">Compras</p>
              <p className="text-lg font-bold tabular-nums">{customer.purchaseCount}</p>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plataforma</span>
              <Badge variant="outline">{customer.platform === 'ios' ? 'iOS' : 'Android'}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Push</span>
              <Badge variant={customer.pushOptIn ? 'success' : 'secondary'}>
                {customer.pushOptIn ? 'Opt-in' : 'Opt-out'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Membro desde</span>
              <span className="text-sm">{new Date(customer.createdAt).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          <Separator />

          {/* Timeline */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Timeline de Eventos</h4>
            <div className="space-y-3">
              {mockTimeline.map((event, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-violet-500" />
                    {index < mockTimeline.length - 1 && (
                      <div className="h-full w-px bg-white/10" />
                    )}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm">{event.detail}</p>
                    <p className="text-xs text-muted-foreground">{event.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
