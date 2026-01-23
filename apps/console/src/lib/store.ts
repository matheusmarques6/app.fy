/**
 * Global state management with Zustand
 * Handles store context and UI state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Store {
  id: string;
  name: string;
  slug: string;
  platform: string;
  primary_domain: string;
  status: string;
}

interface AppState {
  // Current store context
  currentStore: Store | null;
  stores: Store[];

  // UI state
  sidebarOpen: boolean;

  // Actions
  setCurrentStore: (store: Store | null) => void;
  setStores: (stores: Store[]) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      currentStore: null,
      stores: [],
      sidebarOpen: true,

      // Actions
      setCurrentStore: (store) => set({ currentStore: store }),
      setStores: (stores) => set({ stores }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: 'appfy-store',
      partialize: (state) => ({
        currentStore: state.currentStore,
        sidebarOpen: state.sidebarOpen,
      }),
    },
  ),
);

// Hook to get current store ID (for API calls)
export const useCurrentStoreId = (): string | null => {
  return useAppStore((state) => state.currentStore?.id ?? null);
};
