import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TenantInfo {
  id: string
  name: string
  slug: string
}

interface TenantState {
  currentTenant: TenantInfo | null
  tenants: TenantInfo[]
  switchTenant: (tenantId: string) => void
  setTenants: (tenants: TenantInfo[]) => void
  setCurrentTenant: (tenant: TenantInfo | null) => void
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set, get) => ({
      currentTenant: null,
      tenants: [],
      switchTenant: (tenantId: string) => {
        const tenant = get().tenants.find((t) => t.id === tenantId) ?? null
        set({ currentTenant: tenant })
      },
      setTenants: (tenants: TenantInfo[]) => set({ tenants }),
      setCurrentTenant: (tenant: TenantInfo | null) => set({ currentTenant: tenant }),
    }),
    {
      name: 'appfy-tenant',
    },
  ),
)
