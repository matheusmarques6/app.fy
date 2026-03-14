'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CheckCircle, Loader2, Circle, Rocket } from 'lucide-react'
import { appConfig } from '@/lib/mock-data'

const buildSteps = [
  { label: 'Configuracao', status: 'done' },
  { label: 'Build', status: 'done' },
  { label: 'Publicacao', status: 'done' },
]

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case 'done':
      return <CheckCircle className="h-5 w-5 text-emerald-400" />
    case 'active':
      return <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
    default:
      return <Circle className="h-5 w-5 text-muted-foreground" />
  }
}

export function BuildStatus() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Build & Publicacao</CardTitle>
        <Badge variant="success">v{appConfig.currentVersion}</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stepper */}
        <div className="flex items-center gap-4">
          {buildSteps.map((step, index) => (
            <div key={step.label} className="flex items-center gap-2">
              <StepIcon status={step.status} />
              <span className="text-sm">{step.label}</span>
              {index < buildSteps.length - 1 && (
                <div className="h-px w-8 bg-white/10" />
              )}
            </div>
          ))}
        </div>

        <Button className="w-full gap-2">
          <Rocket className="h-4 w-4" />
          Gerar Novo Build
        </Button>

        {/* Build History */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-muted-foreground">Historico de Builds</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Versao</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appConfig.buildHistory.map((build) => (
                <TableRow key={build.id}>
                  <TableCell className="font-mono text-sm">{build.version}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {build.platform === 'android' ? 'Android' : 'iOS'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="success">Publicado</Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {new Date(build.createdAt).toLocaleDateString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
