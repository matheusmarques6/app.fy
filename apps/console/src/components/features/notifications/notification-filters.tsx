'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function NotificationFilters() {
  return (
    <div className="flex flex-wrap gap-3">
      <Select defaultValue="all">
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="draft">Rascunho</SelectItem>
          <SelectItem value="sent">Enviado</SelectItem>
          <SelectItem value="sending">Enviando</SelectItem>
          <SelectItem value="scheduled">Agendado</SelectItem>
          <SelectItem value="failed">Falhou</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue="all">
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="manual">Manual</SelectItem>
          <SelectItem value="automated">Automatico</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue="30d">
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Periodo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Ultimos 7 dias</SelectItem>
          <SelectItem value="30d">Ultimos 30 dias</SelectItem>
          <SelectItem value="90d">Ultimos 90 dias</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
