import { useTenantStore } from '@/stores/tenant.store'

export function useTenant() {
  const { currentTenant, tenants, switchTenant, setTenants, setCurrentTenant } = useTenantStore()

  return {
    currentTenant,
    tenants,
    switchTenant,
    setTenants,
    setCurrentTenant,
    hasTenant: currentTenant !== null,
    tenantId: currentTenant?.id ?? null,
  }
}
