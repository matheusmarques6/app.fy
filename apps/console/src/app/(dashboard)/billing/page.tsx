'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { billingData } from '@/lib/mock-data'
import { PlanBadge } from '@/components/features/billing/plan-badge'
import { UsageBar } from '@/components/features/billing/usage-bar'
import { BillingCycle } from '@/components/features/billing/billing-cycle'
import { InvoiceTable } from '@/components/features/billing/invoice-table'
import { Sparkles } from 'lucide-react'

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-muted-foreground">Gerencie seu plano e pagamentos</p>
        </div>
        <PlanBadge plan={billingData.currentPlan} />
      </div>

      {/* Upgrade CTA */}
      {billingData.currentPlan !== 'elite' && (
        <Card className="border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5">
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-violet-400" />
              <div>
                <p className="font-semibold">Upgrade para {billingData.currentPlan === 'starter' ? 'Business' : 'Elite'}</p>
                <p className="text-sm text-muted-foreground">
                  {billingData.currentPlan === 'starter'
                    ? 'Notificacoes ilimitadas + recursos avancados'
                    : 'Prioridade no suporte + push ilimitado por usuario'}
                </p>
              </div>
            </div>
            <Button className="gap-2">
              <Sparkles className="h-4 w-4" />
              Fazer Upgrade
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <UsageBar sent={billingData.notificationsSent} limit={billingData.notificationLimit} />
        <BillingCycle
          nextDate={billingData.nextBillingDate}
          amountInCents={billingData.nextBillingAmount}
        />
      </div>

      <InvoiceTable />
    </div>
  )
}
