'use client';

import { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        dedupingInterval: 5000,
        errorRetryCount: 2,
      }}
    >
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={4000}
      />
    </SWRConfig>
  );
}
