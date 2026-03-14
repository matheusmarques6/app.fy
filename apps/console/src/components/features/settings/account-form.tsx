'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export function AccountForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Minha Conta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg">MA</AvatarFallback>
          </Avatar>
          <Button variant="outline" size="sm">Alterar Avatar</Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" defaultValue="Matheus Admin" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue="matheus@appfy.com" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tenantUrl">URL do Tenant</Label>
          <Input id="tenantUrl" defaultValue="minha-loja" disabled />
          <p className="text-xs text-muted-foreground">O slug do tenant nao pode ser alterado</p>
        </div>

        <Button>Salvar Alteracoes</Button>
      </CardContent>
    </Card>
  )
}
