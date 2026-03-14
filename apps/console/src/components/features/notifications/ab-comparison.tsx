'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface AbVariant {
  name: string
  title: string
  body: string
  sentCount: number
  openRate: number
  clickRate: number
  conversionRate: number
}

const mockVariants: AbVariant[] = [
  {
    name: 'Variante A',
    title: 'Seu carrinho te espera! 10% OFF',
    body: 'Finalize sua compra e ganhe 10% de desconto',
    sentCount: 1620,
    openRate: 72.3,
    clickRate: 28.4,
    conversionRate: 10.2,
  },
  {
    name: 'Variante B',
    title: 'Esqueceu algo? Aproveite antes que acabe!',
    body: 'Os itens no seu carrinho estao acabando',
    sentCount: 1620,
    openRate: 63.8,
    clickRate: 21.1,
    conversionRate: 8.9,
  },
]

export function AbComparison() {
  const winner = mockVariants[0]!

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Teste A/B</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {mockVariants.map((variant, index) => (
            <div
              key={variant.name}
              className={`rounded-xl border p-4 ${index === 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/5'}`}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="font-medium">{variant.name}</span>
                {variant === winner && <Badge variant="success">Vencedor</Badge>}
              </div>
              <p className="text-sm font-medium">{variant.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{variant.body}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Abertura</p>
                  <p className="text-lg font-bold tabular-nums">{variant.openRate}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cliques</p>
                  <p className="text-lg font-bold tabular-nums">{variant.clickRate}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Conversao</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-400">{variant.conversionRate}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Enviados</p>
                  <p className="text-lg font-bold tabular-nums">{variant.sentCount.toLocaleString('pt-BR')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
