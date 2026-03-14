import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiState {
  sidebarOpen: boolean
  activeModal: string | null
  filters: Record<string, unknown>
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setActiveModal: (modal: string | null) => void
  setFilters: (filters: Record<string, unknown>) => void
  resetFilters: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      activeModal: null,
      filters: {},
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
      setActiveModal: (modal: string | null) => set({ activeModal: modal }),
      setFilters: (filters: Record<string, unknown>) => set({ filters }),
      resetFilters: () => set({ filters: {} }),
    }),
    {
      name: 'appfy-ui',
    },
  ),
)
