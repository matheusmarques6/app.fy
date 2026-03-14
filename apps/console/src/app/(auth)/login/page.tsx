'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// TODO: Wire form submission with react-hook-form + Zod validation
// and Supabase signInWithPassword() for real auth integration
export default function LoginPage() {
  return (
    <Card className="w-full max-w-md border-white/5">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-gradient-violet">AppFy</CardTitle>
        <CardDescription>Entre na sua conta para continuar</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="seu@email.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" placeholder="••••••••" />
        </div>
        <Button className="w-full">Entrar</Button>
        <p className="text-center text-sm text-muted-foreground">
          Esqueceu sua senha?{' '}
          <a href="#" className="text-violet-400 hover:underline">
            Recuperar
          </a>
        </p>
      </CardContent>
    </Card>
  )
}
