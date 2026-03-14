'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Shield } from 'lucide-react'

export function MfaPanel() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Autenticacao Multi-Fator (MFA)</CardTitle>
          <Badge variant="secondary">Inativo</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg bg-white/5 p-4">
          <Shield className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">TOTP (Authenticator App)</p>
            <p className="text-xs text-muted-foreground">
              Use Google Authenticator, Authy ou similar para proteger sua conta.
            </p>
          </div>
        </div>
        <Button variant="outline" className="w-full">Ativar MFA</Button>
      </CardContent>
    </Card>
  )
}
