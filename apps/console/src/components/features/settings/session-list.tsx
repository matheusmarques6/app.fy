'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { activeSessions } from '@/lib/mock-data'

export function SessionList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sessoes Ativas</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dispositivo</TableHead>
              <TableHead>Navegador</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Ultima atividade</TableHead>
              <TableHead className="text-right">Acao</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeSessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="font-medium">
                  {session.device}
                  {session.isCurrent && (
                    <Badge variant="success" className="ml-2 text-xs">Atual</Badge>
                  )}
                </TableCell>
                <TableCell>{session.browser}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{session.ip}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(session.lastActive).toLocaleString('pt-BR')}
                </TableCell>
                <TableCell className="text-right">
                  {!session.isCurrent && (
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300">
                      Revogar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
