export interface Store {
  id: string;
  account_id: string;
  name: string;
  slug: string;
  platform: StorePlatform;
  primary_domain: string;
  status: StoreStatus;
  settings: StoreSettings;
  created_at: string;
  updated_at: string;
}

export type StorePlatform = 'shopify' | 'woocommerce';

export type StoreStatus = 'pending' | 'active' | 'suspended' | 'deleted';

export interface StoreSettings {
  timezone: string;
  default_locale: string;
  supported_locales: string[];
  currency: string;
  push_config: PushConfig;
  allowlist: AllowlistConfig;
}

export interface PushConfig {
  enabled: boolean;
  quiet_hours_start?: string; // HH:mm
  quiet_hours_end?: string;
  max_per_day_per_device: number;
  max_per_minute_per_store: number;
}

export interface AllowlistConfig {
  primary_domains: string[];
  asset_domains: string[];
  payment_rules: PaymentRule[];
  default_for_non_allowlisted: 'external_browser' | 'block';
}

export interface PaymentRule {
  host: string;
  host_pattern?: string;
  allowed_path_prefixes: string[];
  top_level_navigation: 'allow' | 'external_browser' | 'block';
}

export interface CreateStoreRequest {
  name: string;
  platform: StorePlatform;
  primary_domain: string;
  timezone?: string;
  default_locale?: string;
  currency?: string;
}

export interface UpdateStoreRequest {
  name?: string;
  primary_domain?: string;
  settings?: Partial<StoreSettings>;
}
