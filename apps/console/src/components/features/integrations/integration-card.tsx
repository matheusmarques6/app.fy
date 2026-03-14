'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ShoppingBag, Cloud, Mail, Bell, CreditCard } from 'lucide-react'
import type { IntegrationInfo } from '@/types'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'shopping-bag': ShoppingBag,
  'cloud': Cloud,
  'mail': Mail,
  'bell': Bell,
  'credit-card': CreditCard,
}

interface IntegrationCardProps {
  integration: IntegrationInfo
}

export function IntegrationCard({ integration }: IntegrationCardProps) {
  const Icon = iconMap[integration.icon] ?? Bell
  const isConnected = integration.status === 'connected'

  return (
    <Card className={isConnected ? 'border-emerald-500/20' : ''}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${isConnected ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
              <Icon className={`h-6 w-6 ${isConnected ? 'text-emerald-400' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <h3 className="font-semibold">{integration.name}</h3>
              <Badge variant={isConnected ? 'success' : 'secondary'} className="mt-1">
                {isConnected ? 'Conectado' : integration.status === 'error' ? 'Erro' : 'Desconectado'}
              </Badge>
            </div>
          </div>
          <Button
            variant={isConnected ? 'outline' : 'default'}
            size="sm"
          >
            {isConnected ? 'Desconectar' : 'Conectar'}
          </Button>
        </div>

        {integration.lastSync && (
          <p className="mt-3 text-xs text-muted-foreground">
            Ultima sync: {new Date(integration.lastSync).toLocaleString('pt-BR')}
          </p>
        )}

        {isConnected && (
          <Accordion type="single" collapsible className="mt-3">
            <AccordionItem value="webhooks" className="border-white/5">
              <AccordionTrigger className="py-2 text-sm">Webhooks Ativos</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p>orders/create</p>
                  <p>orders/updated</p>
                  <p>carts/update</p>
                  <p>customers/create</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  )
}
