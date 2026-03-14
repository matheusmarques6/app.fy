'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CreateNotificationButton() {
  return (
    <Button className="gap-2">
      <Plus className="h-4 w-4" />
      Nova Notificacao
    </Button>
  )
}
