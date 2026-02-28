import { useState, useEffect } from 'react';
import useSWR, { SWRConfiguration } from 'swr';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/supabase/hooks';
import {
  devicesApi,
  campaignsApi,
  segmentsApi,
  automationsApi,
  analyticsApi,
  Device,
  Campaign,
  Segment,
  Automation,
  AnalyticsOverview,
  PushStats,
  PaginatedResponse,
} from '@/lib/api-client';

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// SWR Hooks
// ============================================================================

function useStoreContext() {
  const params = useParams();
  const storeId = params.storeId as string;
  const { accessToken } = useAuth();
  return { storeId, accessToken };
}

export function useDevices(
  params?: { page?: number; limit?: number; platform?: 'ios' | 'android'; search?: string },
  config?: SWRConfiguration,
) {
  const { storeId, accessToken } = useStoreContext();
  const key = accessToken && storeId
    ? ['devices', storeId, JSON.stringify(params)]
    : null;

  return useSWR<PaginatedResponse<Device>>(
    key,
    () => devicesApi.list(accessToken!, storeId, params),
    { revalidateOnFocus: false, ...config },
  );
}

export function useDeviceStats(config?: SWRConfiguration) {
  const { storeId, accessToken } = useStoreContext();
  const key = accessToken && storeId ? ['device-stats', storeId] : null;

  return useSWR(
    key,
    () => devicesApi.getStats(accessToken!, storeId),
    { revalidateOnFocus: false, ...config },
  );
}

export function useCampaigns(config?: SWRConfiguration) {
  const { storeId, accessToken } = useStoreContext();
  const key = accessToken && storeId ? ['campaigns', storeId] : null;

  return useSWR<Campaign[]>(
    key,
    () => campaignsApi.list(accessToken!, storeId),
    { revalidateOnFocus: false, ...config },
  );
}

export function useSegments(config?: SWRConfiguration) {
  const { storeId, accessToken } = useStoreContext();
  const key = accessToken && storeId ? ['segments', storeId] : null;

  return useSWR<Segment[]>(
    key,
    () => segmentsApi.list(accessToken!, storeId),
    { revalidateOnFocus: false, ...config },
  );
}

export function useAutomations(config?: SWRConfiguration) {
  const { storeId, accessToken } = useStoreContext();
  const key = accessToken && storeId ? ['automations', storeId] : null;

  return useSWR<Automation[]>(
    key,
    () => automationsApi.list(accessToken!, storeId),
    { revalidateOnFocus: false, ...config },
  );
}

export function useAnalyticsOverview(from?: string, to?: string, config?: SWRConfiguration) {
  const { storeId, accessToken } = useStoreContext();
  const key = accessToken && storeId
    ? ['analytics-overview', storeId, from, to]
    : null;

  return useSWR<AnalyticsOverview>(
    key,
    () => analyticsApi.getOverview(accessToken!, storeId, from, to),
    { revalidateOnFocus: false, ...config },
  );
}

export function usePushStats(from?: string, to?: string, config?: SWRConfiguration) {
  const { storeId, accessToken } = useStoreContext();
  const key = accessToken && storeId
    ? ['push-stats', storeId, from, to]
    : null;

  return useSWR<PushStats>(
    key,
    () => analyticsApi.getPushStats(accessToken!, storeId, from, to),
    { revalidateOnFocus: false, ...config },
  );
}
