'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { customers } from '@/lib/mock-data'

function formatBrl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

interface CustomerTableProps {
  onSelect: (customerId: string) => void
}

export function CustomerTable({ onSelect }: CustomerTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Plataforma</TableHead>
          <TableHead>Push</TableHead>
          <TableHead className="text-right">Gasto Total</TableHead>
          <TableHead className="text-right">Compras</TableHead>
          <TableHead className="text-right">Visto em</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((c) => (
          <TableRow
            key={c.id}
            className="cursor-pointer"
            onClick={() => onSelect(c.id)}
          >
            <TableCell className="font-medium">{c.name}</TableCell>
            <TableCell className="text-muted-foreground">{c.email}</TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {c.platform === 'ios' ? 'iOS' : 'Android'}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={c.pushOptIn ? 'success' : 'secondary'} className="text-xs">
                {c.pushOptIn ? 'Ativo' : 'Inativo'}
              </Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatBrl(c.totalSpent)}</TableCell>
            <TableCell className="text-right tabular-nums">{c.purchaseCount}</TableCell>
            <TableCell className="text-right text-sm text-muted-foreground">
              {new Date(c.lastSeen).toLocaleDateString('pt-BR')}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
