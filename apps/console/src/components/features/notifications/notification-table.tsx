'use client'

import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { notifications, flowTypeLabels, notificationStatusLabels, notificationStatusColors } from '@/lib/mock-data'

function formatBrl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function NotificationTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Titulo</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Enviados</TableHead>
          <TableHead className="text-right">Abertos</TableHead>
          <TableHead className="text-right">Conversoes</TableHead>
          <TableHead className="text-right">Receita</TableHead>
          <TableHead className="text-right">Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {notifications.map((n) => (
          <TableRow key={n.id}>
            <TableCell className="max-w-[220px]">
              <Link href={`/notifications/${n.id}`} className="font-medium hover:text-violet-400 transition-colors truncate block">
                {n.title}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {n.flowType ? flowTypeLabels[n.flowType] ?? n.flowType : 'Manual'}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={notificationStatusColors[n.status] as 'success' | 'destructive' | 'secondary' | 'violet' | 'warning'}>
                {notificationStatusLabels[n.status] ?? n.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">{n.sentCount.toLocaleString('pt-BR')}</TableCell>
            <TableCell className="text-right tabular-nums">{n.openedCount.toLocaleString('pt-BR')}</TableCell>
            <TableCell className="text-right tabular-nums">{n.convertedCount.toLocaleString('pt-BR')}</TableCell>
            <TableCell className="text-right tabular-nums text-emerald-400">{formatBrl(n.revenue)}</TableCell>
            <TableCell className="text-right text-muted-foreground text-sm">{formatDate(n.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
