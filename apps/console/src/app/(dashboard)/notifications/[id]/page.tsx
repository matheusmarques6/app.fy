'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { notifications, flowTypeLabels, notificationStatusLabels, notificationStatusColors } from '@/lib/mock-data'
import { PushPreview } from '@/components/features/notifications/push-preview'
import { DeliveryFunnel } from '@/components/features/notifications/delivery-funnel'
import { AbComparison } from '@/components/features/notifications/ab-comparison'

export default function NotificationDetailPage() {
  const params = useParams<{ id: string }>()
  const notification = notifications.find((n) => n.id === params.id) ?? notifications[0]!

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/notifications">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{notification.title}</h1>
            <Badge variant={notificationStatusColors[notification.status] as 'success' | 'destructive' | 'secondary' | 'violet' | 'warning'}>
              {notificationStatusLabels[notification.status] ?? notification.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {notification.flowType ? flowTypeLabels[notification.flowType] ?? notification.flowType : 'Notificacao Manual'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <DeliveryFunnel notification={notification} />
          <AbComparison />
        </div>
        <div>
          <PushPreview
            title={notification.title}
            body="Finalize sua compra e ganhe 10% de desconto exclusivo no app!"
            appName="Minha Loja"
          />
        </div>
      </div>
    </div>
  )
}
