'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import { appConfig } from '@/lib/mock-data'

export function AppConfigForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configuracao do App</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* App Name */}
        <div className="space-y-2">
          <Label htmlFor="appName">Nome do App</Label>
          <Input id="appName" defaultValue={appConfig.appName} />
        </div>

        {/* Package Name */}
        <div className="space-y-2">
          <Label htmlFor="packageName">Package Name</Label>
          <Input id="packageName" defaultValue={appConfig.packageName} />
        </div>

        {/* Icon Upload */}
        <div className="space-y-2">
          <Label>Icone do App</Label>
          <div className="flex h-32 w-32 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-white/5 hover:border-violet-500/30 transition-colors">
            <div className="text-center">
              <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
              <span className="mt-1 block text-xs text-muted-foreground">1024x1024</span>
            </div>
          </div>
        </div>

        {/* Splash Upload */}
        <div className="space-y-2">
          <Label>Splash Screen</Label>
          <div className="flex h-40 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-white/5 hover:border-violet-500/30 transition-colors">
            <div className="text-center">
              <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
              <span className="mt-1 block text-xs text-muted-foreground">2732x2732 PNG</span>
            </div>
          </div>
        </div>

        {/* Colors */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="primaryColor">Cor Primaria</Label>
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-lg border border-white/10"
                style={{ backgroundColor: appConfig.primaryColor }}
              />
              <Input id="primaryColor" defaultValue={appConfig.primaryColor} className="flex-1" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondaryColor">Cor Secundaria</Label>
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-lg border border-white/10"
                style={{ backgroundColor: appConfig.secondaryColor }}
              />
              <Input id="secondaryColor" defaultValue={appConfig.secondaryColor} className="flex-1" />
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="space-y-3">
          <Label>Menu do App</Label>
          {appConfig.menuItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-lg bg-white/5 p-3">
              <span className="text-sm">{item.label}</span>
              <span className="flex-1 text-xs text-muted-foreground">{item.url}</span>
            </div>
          ))}
        </div>

        <Button className="w-full">Salvar Configuracao</Button>
      </CardContent>
    </Card>
  )
}
