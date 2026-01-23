/**
 * App Configuration Types
 * Defines the structure of remote config for mobile apps
 */

// Module configuration
export interface ModuleConfig {
  id: string;
  enabled: boolean;
  order?: number;
  config?: Record<string, any>;
}

export interface ModulesConfig {
  home: ModuleConfig;
  search: ModuleConfig;
  categories: ModuleConfig;
  cart: ModuleConfig;
  wishlist: ModuleConfig;
  account: ModuleConfig;
  orders: ModuleConfig;
  notifications: ModuleConfig;
  // Custom modules
  [key: string]: ModuleConfig;
}

// Theme configuration
export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    error: string;
    text: {
      primary: string;
      secondary: string;
      disabled: string;
    };
  };
  fonts: {
    primary: string;
    secondary?: string;
    headingWeight: number;
    bodyWeight: number;
  };
  borderRadius: {
    small: number;
    medium: number;
    large: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
}

// Allowlist configuration (security)
export interface AllowlistConfig {
  // Primary domains (store URLs)
  primary: string[];
  // Payment provider domains
  payment: string[];
  // Asset/CDN domains
  asset: string[];
  // Deep link schemes
  deeplinks?: string[];
}

// Push notification settings
export interface PushConfig {
  enabled: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm
    end: string;   // HH:mm
  };
  categories: {
    marketing: boolean;
    transactional: boolean;
    updates: boolean;
  };
}

// Feature flags
export interface FeatureFlagsConfig {
  [key: string]: boolean | string | number;
}

// Complete App Config
export interface AppConfig {
  version: number;
  publishedAt: string;
  modules: Partial<ModulesConfig>;
  theme: ThemeConfig;
  allowlist: AllowlistConfig;
  push: PushConfig;
  features: FeatureFlagsConfig;
  // Localized strings (optional)
  strings?: Record<string, Record<string, string>>;
}

// Signed envelope (what the app receives)
export interface RemoteConfigEnvelope {
  config: AppConfig;
  signature: string;
  algorithm: string;
  keyId: string;
  expiresAt: string;
}

// Default theme
export const DEFAULT_THEME: ThemeConfig = {
  colors: {
    primary: '#3B82F6',
    secondary: '#1E293B',
    accent: '#F59E0B',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    error: '#EF4444',
    text: {
      primary: '#1E293B',
      secondary: '#64748B',
      disabled: '#CBD5E1',
    },
  },
  fonts: {
    primary: 'Inter',
    headingWeight: 600,
    bodyWeight: 400,
  },
  borderRadius: {
    small: 4,
    medium: 8,
    large: 16,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};

// Default modules
export const DEFAULT_MODULES: Partial<ModulesConfig> = {
  home: { id: 'home', enabled: true, order: 0 },
  search: { id: 'search', enabled: true, order: 1 },
  categories: { id: 'categories', enabled: true, order: 2 },
  cart: { id: 'cart', enabled: true, order: 3 },
  wishlist: { id: 'wishlist', enabled: true, order: 4 },
  account: { id: 'account', enabled: true, order: 5 },
  orders: { id: 'orders', enabled: true, order: 6 },
  notifications: { id: 'notifications', enabled: true, order: 7 },
};

// Default push config
export const DEFAULT_PUSH_CONFIG: PushConfig = {
  enabled: true,
  quietHours: {
    enabled: true,
    start: '22:00',
    end: '08:00',
  },
  categories: {
    marketing: true,
    transactional: true,
    updates: true,
  },
};
