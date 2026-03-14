'use client'

import { Bell } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

const mockAlerts = [
  { id: '1', message: 'Build v1.2.0 finalizado com sucesso', time: '5 min atras' },
  { id: '2', message: 'Novo usuario registrado no app', time: '15 min atras' },
  { id: '3', message: 'Integracao Klaviyo sincronizada', time: '1h atras' },
]

export function NotificationBell() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">
            {mockAlerts.length}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notificacoes do Sistema</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {mockAlerts.map((alert) => (
          <DropdownMenuItem key={alert.id} className="flex flex-col items-start gap-1 py-3">
            <span className="text-sm">{alert.message}</span>
            <span className="text-xs text-muted-foreground">{alert.time}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
