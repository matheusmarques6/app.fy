'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { CustomerTable } from '@/components/features/customers/customer-table'
import { CustomerDrawer } from '@/components/features/customers/customer-drawer'
import { SegmentList } from '@/components/features/customers/segment-list'

export default function CustomersPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleSelect = (customerId: string) => {
    setSelectedCustomer(customerId)
    setDrawerOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-muted-foreground">Base de usuarios do seu app</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="segments">Segmentos</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <CustomerTable onSelect={handleSelect} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="segments" className="mt-6">
          <SegmentList />
        </TabsContent>
      </Tabs>

      <CustomerDrawer
        customerId={selectedCustomer}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  )
}
