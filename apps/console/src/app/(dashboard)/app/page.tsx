'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AppConfigForm } from '@/components/features/app-config/app-config-form'
import { PhoneMockup } from '@/components/features/app-config/phone-mockup'
import { BuildStatus } from '@/components/features/app-config/build-status'

export default function AppPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">App</h1>
        <p className="text-muted-foreground">Configure e publique seu app movel</p>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuracao</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="build">Build</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <AppConfigForm />
            </div>
            <div>
              <PhoneMockup />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <div className="flex justify-center">
            <PhoneMockup />
          </div>
        </TabsContent>

        <TabsContent value="build" className="mt-6">
          <BuildStatus />
        </TabsContent>
      </Tabs>
    </div>
  )
}
