/**
 * API Client for Core API
 * All calls go through this client with proper auth and store context
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

interface RequestOptions extends RequestInit {
  storeId?: string;
}

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

export interface Store {
  id: string;
  account_id: string;
  name: string;
  slug: string;
  platform: string;
  primary_domain: string;
  status: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  device_fingerprint: string;
  platform: 'ios' | 'android';
  locale?: string;
  timezone?: string;
  country_guess?: string;
  customer_id?: string;
  identity_confirmed: boolean;
  last_seen_at: string;
  created_at: string;
  customer?: {
    id: string;
    external_customer_id?: string;
    tags: string[];
  };
  push_subscriptions?: Array<{
    id: string;
    provider: string;
    opt_in: boolean;
  }>;
  _count?: {
    events: number;
    orders: number;
    segment_memberships: number;
  };
}

export interface Segment {
  id: string;
  name: string;
  description?: string;
  type: string;
  rules: Record<string, unknown>;
  device_count: number;
  status: string;
  created_at: string;
}

export interface Automation {
  id: string;
  name: string;
  description?: string;
  status: string;
  entry_event: string;
  entry_segment_id?: string;
  nodes: unknown[];
  edges: unknown[];
  stats: Record<string, unknown>;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  segment_id?: string;
  template_id: string;
  scheduled_for?: string;
  sent_at?: string;
  stats: Record<string, unknown>;
  created_at: string;
  template?: PushTemplate;
}

export interface PushTemplate {
  id: string;
  name: string;
  title: Record<string, string>;
  body: Record<string, string>;
  image_url?: string;
  deeplink?: string;
}

export interface WebhookEvent {
  id: string;
  webhook_event_id: string;
  provider: string;
  topic: string;
  shop_domain?: string;
  status: string;
  attempts: number;
  last_error?: string;
  received_at: string;
  processed_at?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface AnalyticsOverview {
  devices: {
    total: number;
    new: number;
    active: number;
    push_subscribers: number;
    push_rate: number;
  };
  orders: {
    total: number;
    revenue_minor: number;
  };
  engagement: {
    events: number;
    campaigns_sent: number;
  };
}

export interface PushStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  rates: {
    delivery: number;
    open: number;
    click: number;
  };
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  revenue?: number;
}

// ============================================================================
// Error Handling
// ============================================================================

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

// ============================================================================
// Request Helper
// ============================================================================

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { storeId, headers: customHeaders, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

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

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ============================================================================
// Auth API
// ============================================================================

export const authApi = {
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, name: string) =>
    request<{ access_token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  me: (token: string) =>
    request<{ user: User }>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),
};

// ============================================================================
// Stores API
// ============================================================================

export const storesApi = {
  list: (token: string) =>
    request<Store[]>('/stores', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  get: (token: string, storeId: string) =>
    request<Store>(`/stores/${storeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  create: (token: string, data: Partial<Store>) =>
    request<Store>('/stores', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),

  update: (token: string, storeId: string, data: Partial<Store>) =>
    request<Store>(`/stores/${storeId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
};

// ============================================================================
// Devices API
// ============================================================================

export const devicesApi = {
  list: (
    token: string,
    storeId: string,
    params?: {
      page?: number;
      limit?: number;
      platform?: 'ios' | 'android';
      has_customer?: boolean;
      has_push?: boolean;
      search?: string;
    },
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.platform) searchParams.set('platform', params.platform);
    if (params?.has_customer !== undefined) searchParams.set('has_customer', String(params.has_customer));
    if (params?.has_push !== undefined) searchParams.set('has_push', String(params.has_push));
    if (params?.search) searchParams.set('search', params.search);

    const query = searchParams.toString();
    return request<PaginatedResponse<Device>>(`/devices${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    });
  },

  get: (token: string, storeId: string, deviceId: string) =>
    request<Device>(`/devices/${deviceId}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  update: (token: string, storeId: string, deviceId: string, data: { customer_id?: string | null; identity_confirmed?: boolean }) =>
    request<Device>(`/devices/${deviceId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify(data),
    }),

  delete: (token: string, storeId: string, deviceId: string) =>
    request<{ success: boolean }>(`/devices/${deviceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  getEvents: (token: string, storeId: string, deviceId: string, page?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (page) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    const query = params.toString();
    return request<PaginatedResponse<{ id: string; name: string; props: Record<string, unknown>; ts: string }>>(`/devices/${deviceId}/events${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    });
  },

  getStats: (token: string, storeId: string) =>
    request<{
      total: number;
      by_platform: Record<string, number>;
      active_today: number;
      active_last_7_days: number;
      with_push_enabled: number;
      with_customer: number;
      push_opt_in_rate: number;
      identified_rate: number;
    }>('/devices/stats', {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),
};

// ============================================================================
// Segments API
// ============================================================================

export const segmentsApi = {
  list: (token: string, storeId: string) =>
    request<Segment[]>('/segments', {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  get: (token: string, storeId: string, segmentId: string) =>
    request<Segment>(`/segments/${segmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  create: (token: string, storeId: string, data: Partial<Segment>) =>
    request<Segment>('/segments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify(data),
    }),

  update: (token: string, storeId: string, segmentId: string, data: Partial<Segment>) =>
    request<Segment>(`/segments/${segmentId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify(data),
    }),

  delete: (token: string, storeId: string, segmentId: string) =>
    request<{ success: boolean }>(`/segments/${segmentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  preview: (token: string, storeId: string, segmentId: string) =>
    request<{ devices: Device[]; count: number }>(`/segments/${segmentId}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),
};

// ============================================================================
// Automations API
// ============================================================================

export const automationsApi = {
  list: (token: string, storeId: string) =>
    request<Automation[]>('/automations', {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  get: (token: string, storeId: string, automationId: string) =>
    request<Automation>(`/automations/${automationId}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  create: (token: string, storeId: string, data: Partial<Automation>) =>
    request<Automation>('/automations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify(data),
    }),

  update: (token: string, storeId: string, automationId: string, data: Partial<Automation>) =>
    request<Automation>(`/automations/${automationId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify(data),
    }),

  delete: (token: string, storeId: string, automationId: string) =>
    request<{ success: boolean }>(`/automations/${automationId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  toggle: (token: string, storeId: string, automationId: string, active: boolean) =>
    request<Automation>(`/automations/${automationId}/toggle`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify({ active }),
    }),
};

// ============================================================================
// Campaigns API
// ============================================================================

export const campaignsApi = {
  list: (token: string, storeId: string) =>
    request<Campaign[]>('/campaigns', {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  get: (token: string, storeId: string, campaignId: string) =>
    request<Campaign>(`/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  create: (token: string, storeId: string, data: {
    name: string;
    description?: string;
    type?: string;
    segment_id?: string;
    title: Record<string, string>;
    body: Record<string, string>;
    image_url?: string;
    deeplink?: string;
    timezone?: string;
  }) =>
    request<Campaign>('/campaigns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify(data),
    }),

  update: (token: string, storeId: string, campaignId: string, data: Partial<Campaign>) =>
    request<Campaign>(`/campaigns/${campaignId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify(data),
    }),

  delete: (token: string, storeId: string, campaignId: string) =>
    request<{ success: boolean }>(`/campaigns/${campaignId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  schedule: (token: string, storeId: string, campaignId: string, scheduledFor: string) =>
    request<Campaign>(`/campaigns/${campaignId}/schedule`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify({ scheduled_for: scheduledFor }),
    }),

  send: (token: string, storeId: string, campaignId: string) =>
    request<Campaign>(`/campaigns/${campaignId}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),
};

// ============================================================================
// Webhooks API
// ============================================================================

export const webhooksApi = {
  list: (
    token: string,
    storeId: string,
    params?: {
      page?: number;
      limit?: number;
      provider?: 'shopify' | 'woocommerce';
      topic?: string;
      status?: 'received' | 'processing' | 'processed' | 'failed';
      from?: string;
      to?: string;
    },
  ) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.provider) searchParams.set('provider', params.provider);
    if (params?.topic) searchParams.set('topic', params.topic);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);

    const query = searchParams.toString();
    return request<PaginatedResponse<WebhookEvent>>(`/webhooks${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    });
  },

  get: (token: string, storeId: string, eventId: string) =>
    request<WebhookEvent>(`/webhooks/${eventId}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  retry: (token: string, storeId: string, eventId: string) =>
    request<{ success: boolean; message: string }>(`/webhooks/${eventId}/retry`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  bulkRetry: (token: string, storeId: string, eventIds: string[]) =>
    request<{ success: boolean; retried: number }>('/webhooks/bulk-retry', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify({ event_ids: eventIds }),
    }),

  getStats: (token: string, storeId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return request<{
      total: number;
      by_status: Record<string, number>;
      by_provider: Record<string, number>;
      top_topics: Array<{ topic: string; count: number }>;
      success_rate: number;
      recent_failures: WebhookEvent[];
    }>(`/webhooks/stats${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    });
  },

  cleanup: (token: string, storeId: string, olderThanDays?: number) => {
    const params = new URLSearchParams();
    if (olderThanDays) params.set('older_than_days', String(olderThanDays));
    const query = params.toString();
    return request<{ deleted: number }>(`/webhooks/cleanup${query ? `?${query}` : ''}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    });
  },
};

// ============================================================================
// Analytics API
// ============================================================================

export const analyticsApi = {
  getOverview: (token: string, storeId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return request<AnalyticsOverview>(`/analytics/overview${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    });
  },

  getPushStats: (token: string, storeId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return request<PushStats>(`/analytics/push${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    });
  },

  getCampaignStats: (token: string, storeId: string, from?: string, to?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (limit) params.set('limit', String(limit));
    const query = params.toString();
    return request<Array<{
      id: string;
      name: string;
      status: string;
      sent_at: string;
      total_deliveries: number;
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
      open_rate: number;
      click_rate: number;
    }>>(`/analytics/campaigns${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    });
  },

  getEventStats: (token: string, storeId: string, from?: string, to?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (limit) params.set('limit', String(limit));
    const query = params.toString();
    return request<{
      total: number;
      by_type: Array<{ name: string; count: number; percentage: number }>;
    }>(`/analytics/events${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    });
  },

  getRevenueAttribution: (token: string, storeId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return request<{
      total_revenue_minor: number;
      attributed_revenue_minor: number;
      attribution_rate: number;
      by_model: Array<{ model: string; orders: number; revenue_minor: number }>;
    }>(`/analytics/revenue${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    });
  },

  getAutomationStats: (token: string, storeId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return request<Array<{
      id: string;
      name: string;
      entry_event: string;
      total_runs: number;
      total_deliveries: number;
      runs_in_period: { running: number; completed: number; exited: number };
    }>>(`/analytics/automations${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    });
  },

  getDevicesTimeSeries: (token: string, storeId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return request<TimeSeriesPoint[]>(`/analytics/timeseries/devices${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    });
  },

  getOrdersTimeSeries: (token: string, storeId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return request<TimeSeriesPoint[]>(`/analytics/timeseries/orders${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    });
  },

  getEventsTimeSeries: (token: string, storeId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return request<TimeSeriesPoint[]>(`/analytics/timeseries/events${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    });
  },
};

// ============================================================================
// Apps API (App Builder)
// ============================================================================

export interface App {
  id: string;
  store_id: string;
  name: string;
  bundle_id_ios?: string;
  bundle_id_android?: string;
  status: 'draft' | 'building' | 'published' | 'suspended';
  config: Record<string, unknown>;
  onesignal_app_id?: string;
  onesignal_api_key?: string;
  rc_public_key?: string;
  icon_url?: string;
  splash_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AppVersion {
  id: string;
  app_id: string;
  version_code: number;
  version_name: string;
  platform: 'ios' | 'android';
  status: 'pending' | 'building' | 'built' | 'published' | 'failed';
  build_log_url?: string;
  artifact_url?: string;
  created_at: string;
}

export interface AppCredential {
  id: string;
  app_id: string;
  platform: 'ios' | 'android';
  credential_type: string;
  metadata: {
    teamId?: string;
    bundleId?: string;
    commonName?: string;
    expiresAt?: string;
    keyAlias?: string;
    validUntil?: string;
    fingerprintSha256?: string;
  };
  created_at: string;
}

export interface BuildJob {
  id: string;
  app_version_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  external_build_id?: string;
  started_at?: string;
  completed_at?: string;
  log_url?: string;
  error_message?: string;
  created_at: string;
}

export interface BuildReadiness {
  ready: boolean;
  checks: {
    hasIcon: boolean;
    hasSplash: boolean;
    hasIosCredentials: boolean;
    hasAndroidCredentials: boolean;
    hasOneSignal: boolean;
    hasKeypair: boolean;
  };
  missing: string[];
}

export const appsApi = {
  create: (token: string, storeId: string, name?: string) =>
    request<App>('/apps', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify({ store_id: storeId, name }),
    }),

  list: (token: string, storeId: string) =>
    request<App[]>('/apps', {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  get: (token: string, storeId: string, appId: string) =>
    request<App>(`/apps/${appId}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  update: (token: string, storeId: string, appId: string, data: Partial<App>) =>
    request<App>(`/apps/${appId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify(data),
    }),

  getVersions: (token: string, storeId: string, appId: string) =>
    request<AppVersion[]>(`/apps/${appId}/versions`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  generateKeypair: (token: string, storeId: string, appId: string) =>
    request<{ publicKey: string }>(`/apps/${appId}/generate-keypair`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  setOneSignal: (token: string, storeId: string, appId: string, data: { app_id: string; api_key: string }) =>
    request<App>(`/apps/${appId}/onesignal`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify(data),
    }),

  removeOneSignal: (token: string, storeId: string, appId: string) =>
    request<App>(`/apps/${appId}/onesignal`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  getBuildReadiness: (token: string, storeId: string, appId: string) =>
    request<BuildReadiness>(`/apps/${appId}/build-readiness`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  getIntegrationStatus: (token: string, storeId: string) =>
    request<{
      connected: boolean;
      platform?: string;
      shopDomain?: string;
      shopName?: string;
    }>(`/apps/integration-status?store_id=${storeId}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),
};

// ============================================================================
// Integrations API
// ============================================================================

export interface StorePreview {
  connected: boolean;
  shop?: {
    name: string;
    domain: string;
    logo?: string;
    currency: string;
  };
  products: Array<{
    id: string;
    title: string;
    image?: string;
    price: string;
    currency: string;
  }>;
}

export const integrationsApi = {
  // Shopify credentials management (per-store)
  getShopifyCredentials: (token: string, storeId: string) =>
    request<{ configured: boolean; api_key_preview?: string }>('/integrations/shopify/credentials', {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  saveShopifyCredentials: (token: string, storeId: string, apiKey: string, apiSecret: string) =>
    request<{ success: boolean }>('/integrations/shopify/credentials', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
    }),

  getShopifyPreview: (token: string, storeId: string) =>
    request<StorePreview>('/integrations/shopify/preview', {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  getShopifyStatus: (token: string, storeId: string) =>
    request<{
      id: string;
      platform: string;
      status: string;
      shop_domain?: string;
      scopes: string[];
      last_sync_at?: string;
      created_at: string;
    } | null>('/integrations/shopify/status', {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  // Connect using Client Credentials (new Shopify Dev Dashboard method)
  connectShopifyManual: (token: string, storeId: string, shopDomain: string, clientId: string, clientSecret: string) =>
    request<{ success: boolean; integration_id: string }>('/integrations/shopify/connect-manual', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify({ shop_domain: shopDomain, client_id: clientId, client_secret: clientSecret }),
    }),

  disconnectShopify: (token: string, storeId: string) =>
    request<{ success: boolean }>('/integrations/shopify/disconnect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  // Start OAuth flow (returns URL to redirect user to Shopify)
  startShopifyInstall: (token: string, storeId: string, shop: string) =>
    request<{ install_url: string; state: string }>('/integrations/shopify/install', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify({ shop }),
    }),
};

// ============================================================================
// Assets API (App Builder)
// ============================================================================

export interface AppAssets {
  icon_url?: string;
  splash_url?: string;
}

export const assetsApi = {
  list: (token: string, storeId: string, appId: string) =>
    request<AppAssets>(`/apps/${appId}/assets`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  uploadIcon: async (token: string, storeId: string, appId: string, file: File) => {
    const formData = new FormData();
    formData.append('icon', file);

    const response = await fetch(`${API_BASE_URL}/apps/${appId}/assets/icon`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Store-Id': storeId,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.code || 'UPLOAD_ERROR', error.message || 'Failed to upload icon');
    }

    return response.json() as Promise<{ icon_url: string; processed_sizes: number }>;
  },

  uploadSplash: async (token: string, storeId: string, appId: string, file: File) => {
    const formData = new FormData();
    formData.append('splash', file);

    const response = await fetch(`${API_BASE_URL}/apps/${appId}/assets/splash`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Store-Id': storeId,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.code || 'UPLOAD_ERROR', error.message || 'Failed to upload splash');
    }

    return response.json() as Promise<{ splash_url: string }>;
  },

  deleteIcon: (token: string, storeId: string, appId: string) =>
    request<void>(`/apps/${appId}/assets/icon`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  deleteSplash: (token: string, storeId: string, appId: string) =>
    request<void>(`/apps/${appId}/assets/splash`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  getIconUrl: (token: string, storeId: string, appId: string) =>
    request<{ url: string; expires_at: string }>(`/apps/${appId}/assets/icon/url`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  getSplashUrl: (token: string, storeId: string, appId: string) =>
    request<{ url: string; expires_at: string }>(`/apps/${appId}/assets/splash/url`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),
};

// ============================================================================
// Credentials API (App Builder)
// ============================================================================

export const credentialsApi = {
  list: (token: string, storeId: string, appId: string) =>
    request<AppCredential[]>(`/apps/${appId}/credentials`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  get: (token: string, storeId: string, appId: string, credentialId: string) =>
    request<AppCredential>(`/apps/${appId}/credentials/${credentialId}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  uploadIos: async (
    token: string,
    storeId: string,
    appId: string,
    data: {
      certificate_p12: string; // base64
      password: string;
      provisioning_profile: string; // base64
    },
  ) =>
    request<AppCredential>(`/apps/${appId}/credentials/ios`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify(data),
    }),

  uploadAndroid: async (
    token: string,
    storeId: string,
    appId: string,
    data: {
      keystore: string; // base64
      keystore_password: string;
      key_alias: string;
      key_password: string;
    },
  ) =>
    request<AppCredential>(`/apps/${appId}/credentials/android`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify(data),
    }),

  delete: (token: string, storeId: string, appId: string, credentialId: string) =>
    request<void>(`/apps/${appId}/credentials/${credentialId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),
};

// ============================================================================
// Builds API (App Builder)
// ============================================================================

export interface Build {
  id: string;
  version: {
    id: string;
    version_code: number;
    version_name: string;
    platform: 'ios' | 'android';
    status: string;
    artifact_url?: string;
  };
  job: BuildJob;
}

export const buildsApi = {
  create: (
    token: string,
    storeId: string,
    appId: string,
    data: {
      platform: 'ios' | 'android';
      version_name: string;
      build_type?: 'debug' | 'release';
    },
  ) =>
    request<Build>(`/apps/${appId}/builds`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
      body: JSON.stringify(data),
    }),

  list: (token: string, storeId: string, appId: string, params?: { platform?: 'ios' | 'android'; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.platform) searchParams.set('platform', params.platform);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();

    return request<Build[]>(`/apps/${appId}/builds${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    });
  },

  get: (token: string, storeId: string, appId: string, buildId: string) =>
    request<Build>(`/apps/${appId}/builds/${buildId}`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  getLogs: (token: string, storeId: string, appId: string, buildId: string) =>
    request<{ logs: string }>(`/apps/${appId}/builds/${buildId}/logs`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  getDownloadUrl: (token: string, storeId: string, appId: string, buildId: string) =>
    request<{ url: string; expires_at: string }>(`/apps/${appId}/builds/${buildId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),

  cancel: (token: string, storeId: string, appId: string, buildId: string) =>
    request<void>(`/apps/${appId}/builds/${buildId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      storeId,
    }),
};

export { ApiError };
