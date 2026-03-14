'use client'

import { Card, CardContent } from '@/components/ui/card'
import { NotificationTable } from '@/components/features/notifications/notification-table'
import { NotificationFilters } from '@/components/features/notifications/notification-filters'
import { CreateNotificationButton } from '@/components/features/notifications/create-notification-button'

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificacoes</h1>
          <p className="text-muted-foreground">Gerencie suas notificacoes push</p>
        </div>
        <CreateNotificationButton />
      </div>

      <NotificationFilters />

      <Card>
        <CardContent className="p-0">
          <NotificationTable />
        </CardContent>
      </Card>
    </div>
  )
}
