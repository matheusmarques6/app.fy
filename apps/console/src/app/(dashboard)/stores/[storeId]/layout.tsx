'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { useAppStore } from '@/lib/store';
import { storesApi } from '@/lib/api-client';

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const storeId = params.storeId as string;
  const { currentStore, stores, setCurrentStore, setStores } = useAppStore();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated' && session?.accessToken) {
      // Load stores if not loaded
      if (stores.length === 0) {
        storesApi.list(session.accessToken).then((data) => {
          setStores(data);

          // Set current store from URL
          const store = data.find((s: any) => s.id === storeId);
          if (store) {
            setCurrentStore(store);
          } else if (data.length > 0) {
            // Redirect to first store if storeId not found
            router.push(`/stores/${data[0].id}/dashboard`);
          } else {
            // No stores, redirect to create
            router.push('/stores/new');
          }
        }).catch(console.error);
      } else {
        // Stores loaded, just set current
        const store = stores.find((s) => s.id === storeId);
        if (store && currentStore?.id !== store.id) {
          setCurrentStore(store);
        }
      }
    }
  }, [status, session, storeId, stores, currentStore, router, setCurrentStore, setStores]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
