'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plus, Store, ArrowRight, Loader2 } from 'lucide-react';
import { storesApi } from '@/lib/api-client';
import { useAppStore } from '@/lib/store';

interface StoreItem {
  id: string;
  name: string;
  primary_domain: string;
  created_at: string;
}

export default function StoresPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { setStores, setCurrentStore } = useAppStore();
  const [storeList, setStoreList] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated' && session?.accessToken) {
      storesApi.list(session.accessToken)
        .then((data) => {
          setStoreList(data);
          setStores(data);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [status, session, router, setStores]);

  const handleSelectStore = (store: StoreItem) => {
    setCurrentStore(store);
    router.push(`/stores/${store.id}/dashboard`);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-2">Select a Store</h1>
          <p className="text-gray-400">Choose a store to manage or create a new one</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {storeList.map((store) => (
            <button
              key={store.id}
              onClick={() => handleSelectStore(store)}
              className="flex items-center justify-between p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center">
                  <Store className="text-blue-500" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">{store.name}</h3>
                  <p className="text-sm text-gray-400">{store.primary_domain}</p>
                </div>
              </div>
              <ArrowRight className="text-gray-500 group-hover:text-white transition-colors" size={20} />
            </button>
          ))}

          {/* Create New Store */}
          <button
            onClick={() => router.push('/stores/new')}
            className="flex items-center justify-center gap-3 p-6 bg-gray-900 border-2 border-dashed border-gray-700 rounded-lg hover:border-blue-500 transition-colors group"
          >
            <Plus className="text-gray-500 group-hover:text-blue-500 transition-colors" size={24} />
            <span className="text-gray-400 group-hover:text-white transition-colors font-medium">
              Create New Store
            </span>
          </button>
        </div>

        {storeList.length === 0 && (
          <div className="text-center mt-8">
            <p className="text-gray-500">
              You don't have any stores yet. Create your first store to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
