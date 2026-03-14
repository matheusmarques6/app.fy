'use client'

import { Store, ChevronDown, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useTenantStore } from '@/stores/tenant.store'
import { mockTenants } from '@/lib/mock-data'
import { useEffect } from 'react'

export function TenantSwitcher() {
  const { currentTenant, tenants, switchTenant, setTenants, setCurrentTenant } = useTenantStore()

  useEffect(() => {
    if (tenants.length === 0) {
      setTenants(mockTenants)
      if (!currentTenant) {
        setCurrentTenant(mockTenants[0]!)
      }
    }
  }, [tenants.length, currentTenant, setTenants, setCurrentTenant])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-3">
          <Store className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-medium">{currentTenant?.name ?? 'Selecionar loja'}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Suas lojas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tenants.map((tenant) => (
          <DropdownMenuItem
            key={tenant.id}
            onClick={() => switchTenant(tenant.id)}
            className="gap-2"
          >
            <Store className="h-4 w-4" />
            <span className="flex-1">{tenant.name}</span>
            {currentTenant?.id === tenant.id && <Check className="h-4 w-4 text-violet-400" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
