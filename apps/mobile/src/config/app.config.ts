import defaultConfig from './default.config.json';

export interface TenantConfig {
  readonly tenantId: string;
  readonly appName: string;
  readonly storeUrl: string;
  readonly onesignalAppId: string;
  readonly apiBaseUrl: string;
  readonly theme: {
    readonly primaryColor: string;
    readonly backgroundColor: string;
    readonly accentColor: string;
  };
  readonly logoUrl: string;
  readonly splashUrl: string;
  readonly features: {
    readonly biometrics: boolean;
    readonly haptics: boolean;
    readonly offlineMode: boolean;
  };
}

let currentConfig: TenantConfig | null = null;

/**
 * Loads tenant-specific configuration.
 * In production, this reads from a bundled JSON config generated at build time.
 * Falls back to default config for development.
 */
export function loadTenantConfig(overrides?: Partial<TenantConfig>): TenantConfig {
  const base = defaultConfig as TenantConfig;
  if (!overrides) {
    currentConfig = base;
  } else {
    currentConfig = {
      ...base,
      ...overrides,
      theme: { ...base.theme, ...overrides.theme },
      features: { ...base.features, ...overrides.features },
    };
  }
  return currentConfig;
}

/**
 * Returns the current tenant config. Throws if not yet loaded.
 */
export function getTenantConfig(): TenantConfig {
  if (!currentConfig) {
    throw new Error('Tenant config not loaded. Call loadTenantConfig() first.');
  }
  return currentConfig;
}
