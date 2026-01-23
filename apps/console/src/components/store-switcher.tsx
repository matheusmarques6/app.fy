'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Store, Plus, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppStore } from '../lib/store';

interface StoreSwitcherProps {
  collapsed?: boolean;
}

export function StoreSwitcher({ collapsed = false }: StoreSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { currentStore, stores, setCurrentStore } = useAppStore();

  const handleSelectStore = (store: typeof currentStore) => {
    if (store) {
      setCurrentStore(store);
      router.push(`/stores/${store.id}/dashboard`);
    }
    setOpen(false);
  };

  const handleCreateStore = () => {
    setOpen(false);
    router.push('/stores/new');
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
      >
        <Store size={20} className="mx-auto text-gray-400" />
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Store size={18} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm text-white truncate">
            {currentStore?.name || 'Select Store'}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={cn(
            'text-gray-400 transition-transform flex-shrink-0',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute left-0 right-0 mt-2 py-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 max-h-64 overflow-y-auto">
            {stores.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                No stores yet
              </div>
            ) : (
              stores.map((store) => (
                <button
                  key={store.id}
                  onClick={() => handleSelectStore(store)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-700 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-white truncate">{store.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {store.primary_domain}
                    </div>
                  </div>
                  {currentStore?.id === store.id && (
                    <Check size={16} className="text-green-500 flex-shrink-0" />
                  )}
                </button>
              ))
            )}

            <div className="border-t border-gray-700 mt-1 pt-1">
              <button
                onClick={handleCreateStore}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-gray-700 transition-colors"
              >
                <Plus size={16} />
                <span>Create new store</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
