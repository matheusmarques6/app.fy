import useSWR, { type SWRConfiguration } from 'swr'
import { apiClient } from '@/lib/api-client'

export function useApi<T>(path: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(
    path,
    (url: string) => apiClient.get<T>(url),
    {
      revalidateOnFocus: false,
      ...config,
    },
  )
}
