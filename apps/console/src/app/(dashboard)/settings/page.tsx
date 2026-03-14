'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AccountForm } from '@/components/features/settings/account-form'
import { TeamTable } from '@/components/features/settings/team-table'
import { InviteModal } from '@/components/features/settings/invite-modal'
import { MfaPanel } from '@/components/features/settings/mfa-panel'
import { SessionList } from '@/components/features/settings/session-list'
import { AuditMiniLog } from '@/components/features/settings/audit-mini-log'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuracoes</h1>
        <p className="text-muted-foreground">Gerencie sua conta, equipe e seguranca</p>
      </div>

      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Conta</TabsTrigger>
          <TabsTrigger value="team">Equipe</TabsTrigger>
          <TabsTrigger value="security">Seguranca</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-6">
          <AccountForm />
        </TabsContent>

        <TabsContent value="team" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <InviteModal />
          </div>
          <TeamTable />
        </TabsContent>

        <TabsContent value="security" className="mt-6 space-y-6">
          <MfaPanel />
          <SessionList />
          <AuditMiniLog />
        </TabsContent>
      </Tabs>
    </div>
  )
}
