type TokenProvider = () => Promise<string | null>

let tokenProvider: TokenProvider | null = null
let currentTenantId: string | null = null

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

export function setAuthTokenProvider(provider: TokenProvider) {
  tokenProvider = provider
}

export function setCurrentTenantId(tenantId: string | null) {
  currentTenantId = tenantId
}

interface RequestOptions {
  headers?: Record<string, string>
  signal?: AbortSignal
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  }

  if (tokenProvider) {
    const token = await tokenProvider()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  if (currentTenantId) {
    headers['X-Tenant-Id'] = currentTenantId
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: options?.signal,
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => ({
      message: response.statusText,
    }))) as { message: string }
    throw new Error(error.message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>('GET', path, undefined, options)
  },
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('POST', path, body, options)
  },
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>('PUT', path, body, options)
  },
  del<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>('DELETE', path, undefined, options)
  },
}
