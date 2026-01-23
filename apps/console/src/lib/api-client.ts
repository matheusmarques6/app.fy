/**
 * API Client for Core API
 * All calls go through this client with proper auth and store context
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

interface RequestOptions extends RequestInit {
  storeId?: string;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { storeId, headers: customHeaders, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  // Add store context if provided
  if (storeId) {
    headers['X-Store-Id'] = storeId;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      error.code || 'UNKNOWN_ERROR',
      error.message || 'An error occurred',
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Auth endpoints (called from server-side)
export const authApi = {
  login: (email: string, password: string) =>
    request<{ access_token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, name: string) =>
    request<{ access_token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  me: (token: string) =>
    request<{ user: any }>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),
};

// Stores endpoints
export const storesApi = {
  list: (token: string) =>
    request<any[]>('/stores', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  get: (token: string, storeId: string) =>
    request<any>(`/stores/${storeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getStats: (token: string, storeId: string) =>
    request<any>(`/stores/${storeId}/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  create: (token: string, data: any) =>
    request<any>('/stores', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),

  update: (token: string, storeId: string, data: any) =>
    request<any>(`/stores/${storeId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
};

// Segments endpoints
export const segmentsApi = {
  list: (token: string, storeId: string) =>
    request<any[]>('/segments', {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  get: (token: string, storeId: string, segmentId: string) =>
    request<any>(`/segments/${segmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  create: (token: string, storeId: string, data: any) =>
    request<any>('/segments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify(data),
    }),
};

// Automations endpoints
export const automationsApi = {
  list: (token: string, storeId: string) =>
    request<any[]>('/automations', {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  get: (token: string, storeId: string, automationId: string) =>
    request<any>(`/automations/${automationId}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  create: (token: string, storeId: string, data: any) =>
    request<any>('/automations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify(data),
    }),

  update: (token: string, storeId: string, automationId: string, data: any) =>
    request<any>(`/automations/${automationId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify(data),
    }),
};

// Campaigns endpoints
export const campaignsApi = {
  list: (token: string, storeId: string) =>
    request<any[]>('/campaigns', {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  get: (token: string, storeId: string, campaignId: string) =>
    request<any>(`/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  create: (token: string, storeId: string, data: any) =>
    request<any>('/campaigns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify(data),
    }),

  schedule: (token: string, storeId: string, campaignId: string, scheduledFor: string) =>
    request<any>(`/campaigns/${campaignId}/schedule`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify({ scheduled_for: scheduledFor }),
    }),
};

// Analytics endpoints
export const analyticsApi = {
  getDashboard: (token: string, storeId: string, period: string = '7d') =>
    request<any>(`/analytics/dashboard?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  getPushStats: (token: string, storeId: string, period: string = '7d') =>
    request<any>(`/analytics/push?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),
};

export { ApiError };
