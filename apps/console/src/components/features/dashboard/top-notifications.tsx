'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { topNotifications, flowTypeLabels } from '@/lib/mock-data'

function formatBrl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export function TopNotifications() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top 5 Notificacoes por Conversao</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titulo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Conversoes</TableHead>
              <TableHead className="text-right">Receita</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topNotifications.map((n) => (
              <TableRow key={n.id}>
                <TableCell className="max-w-[200px] truncate font-medium">{n.title}</TableCell>
                <TableCell>
                  <Badge variant="violet" className="text-xs">
                    {n.flowType ? flowTypeLabels[n.flowType] ?? n.flowType : 'Manual'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{n.convertedCount}</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-400">
                  {formatBrl(n.revenue)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
