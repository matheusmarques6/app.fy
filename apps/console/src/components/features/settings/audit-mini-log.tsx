'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { auditLog } from '@/lib/mock-data'

export function AuditMiniLog() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Atividade Recente</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {auditLog.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 rounded-lg bg-white/[0.02] p-3">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-500" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{entry.resource}</p>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(entry.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {entry.userName} - {entry.action}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
