'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Layers,
  Palette,
  Shield,
  Code,
  Save,
  Rocket,
  Loader2,
  Check,
  X,
  ChevronDown,
  History,
  RotateCcw,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

type Tab = 'modules' | 'theme' | 'allowlist' | 'preview';

interface ModuleConfig {
  id: string;
  enabled: boolean;
  order?: number;
}

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  error: string;
}

interface AppConfig {
  version: number;
  publishedAt: string;
  modules: Record<string, ModuleConfig>;
  theme: {
    colors: ThemeColors;
    fonts: {
      primary: string;
      headingWeight: number;
      bodyWeight: number;
    };
    borderRadius: {
      small: number;
      medium: number;
      large: number;
    };
  };
  allowlist: {
    primary: string[];
    payment: string[];
    asset: string[];
  };
  push: {
    enabled: boolean;
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
  };
  features: Record<string, boolean>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

const DEFAULT_MODULES = [
  { id: 'home', label: 'Home', description: 'Main landing page' },
  { id: 'search', label: 'Search', description: 'Product search' },
  { id: 'categories', label: 'Categories', description: 'Category browser' },
  { id: 'cart', label: 'Cart', description: 'Shopping cart' },
  { id: 'wishlist', label: 'Wishlist', description: 'Save items for later' },
  { id: 'account', label: 'Account', description: 'User profile' },
  { id: 'orders', label: 'Orders', description: 'Order history' },
  { id: 'notifications', label: 'Notifications', description: 'Push notification center' },
];

export default function AppBuilderPage() {
  const { data: session } = useSession();
  const params = useParams();
  const storeId = params.storeId as string;
  const { currentStore } = useAppStore();

  const [activeTab, setActiveTab] = useState<Tab>('modules');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  // Default app ID (first app for the store)
  const [appId, setAppId] = useState<string | null>(null);

  const tabs = [
    { id: 'modules' as Tab, label: 'Modules', icon: Layers },
    { id: 'theme' as Tab, label: 'Theme', icon: Palette },
    { id: 'allowlist' as Tab, label: 'Security', icon: Shield },
    { id: 'preview' as Tab, label: 'Preview', icon: Code },
  ];

  // Load config on mount
  useEffect(() => {
    if (!session?.accessToken || !storeId) return;

    async function loadConfig() {
      try {
        // First, get the app for this store
        const appsRes = await fetch(`${API_URL}/stores/${storeId}`, {
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
          },
        });

        if (appsRes.ok) {
          const storeData = await appsRes.json();
          // Assuming store has apps array or default_app_id
          const defaultAppId = storeData.apps?.[0]?.id || storeData.default_app_id;

          if (defaultAppId) {
            setAppId(defaultAppId);

            // Load the config
            const configRes = await fetch(`${API_URL}/remote-config/apps/${defaultAppId}/draft`, {
              headers: {
                Authorization: `Bearer ${session?.accessToken}`,
                'X-Store-Id': storeId,
              },
            });

            if (configRes.ok) {
              const configData = await configRes.json();
              setConfig(configData);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [session?.accessToken, storeId]);

  // Save config
  const saveConfig = async () => {
    if (!appId || !config || !session?.accessToken) return;

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/remote-config/apps/${appId}/draft`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
          'X-Store-Id': storeId,
        },
        body: JSON.stringify({
          modules: config.modules,
          theme: config.theme,
          allowlist: config.allowlist,
          push: config.push,
          features: config.features,
        }),
      });

      if (res.ok) {
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setSaving(false);
    }
  };

  // Publish config
  const publishConfig = async () => {
    if (!appId || !session?.accessToken) return;

    setPublishing(true);
    try {
      // Save first
      await saveConfig();

      // Then publish
      const res = await fetch(`${API_URL}/remote-config/apps/${appId}/publish`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'X-Store-Id': storeId,
        },
      });

      if (res.ok) {
        const newConfig = await res.json();
        setConfig(newConfig);
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Failed to publish config:', error);
    } finally {
      setPublishing(false);
    }
  };

  // Update module
  const updateModule = (moduleId: string, enabled: boolean) => {
    if (!config) return;

    setConfig({
      ...config,
      modules: {
        ...config.modules,
        [moduleId]: {
          ...config.modules[moduleId],
          id: moduleId,
          enabled,
        },
      },
    });
    setHasChanges(true);
  };

  // Update theme color
  const updateThemeColor = (key: keyof ThemeColors, value: string) => {
    if (!config) return;

    setConfig({
      ...config,
      theme: {
        ...config.theme,
        colors: {
          ...config.theme.colors,
          [key]: value,
        },
      },
    });
    setHasChanges(true);
  };

  // Update allowlist
  const updateAllowlist = (type: 'primary' | 'payment' | 'asset', values: string[]) => {
    if (!config) return;

    setConfig({
      ...config,
      allowlist: {
        ...config.allowlist,
        [type]: values,
      },
    });
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">App Builder</h1>
          <p className="text-gray-400 mt-1">
            Configure your mobile app for {currentStore?.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-sm text-yellow-400">Unsaved changes</span>
          )}
          <button
            onClick={saveConfig}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg transition-colors"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            <span>Save Draft</span>
          </button>
          <button
            onClick={publishConfig}
            disabled={publishing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors"
          >
            {publishing ? <Loader2 size={18} className="animate-spin" /> : <Rocket size={18} />}
            <span>Publish</span>
          </button>
        </div>
      </div>

      {/* Version info */}
      {config && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">
            Version {config.version} | Published: {new Date(config.publishedAt).toLocaleString()}
          </span>
          <button
            onClick={() => setShowVersions(!showVersions)}
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
          >
            <History size={14} />
            <span>Version History</span>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        {/* Modules Tab */}
        {activeTab === 'modules' && config && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium text-white mb-2">App Modules</h2>
              <p className="text-gray-400 text-sm">Enable or disable features in your app</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DEFAULT_MODULES.map((module) => {
                const moduleConfig = config.modules[module.id];
                const isEnabled = moduleConfig?.enabled ?? true;

                return (
                  <div
                    key={module.id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      isEnabled
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-gray-900 border-gray-800 opacity-60'
                    }`}
                  >
                    <div>
                      <h3 className="text-white font-medium">{module.label}</h3>
                      <p className="text-sm text-gray-400">{module.description}</p>
                    </div>
                    <button
                      onClick={() => updateModule(module.id, !isEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        isEnabled ? 'bg-blue-600' : 'bg-gray-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          isEnabled ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Theme Tab */}
        {activeTab === 'theme' && config && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium text-white mb-2">Theme Settings</h2>
              <p className="text-gray-400 text-sm">Customize your app's appearance</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(config.theme.colors).map(([key, value]) => {
                if (typeof value !== 'string') return null;
                return (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-300 mb-2 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => updateThemeColor(key as keyof ThemeColors, e.target.value)}
                        className="w-12 h-10 bg-gray-800 border border-gray-700 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => updateThemeColor(key as keyof ThemeColors, e.target.value)}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-800 pt-6">
              <h3 className="text-white font-medium mb-4">Typography</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Font Family</label>
                  <select
                    value={config.theme.fonts.primary}
                    onChange={(e) => {
                      setConfig({
                        ...config,
                        theme: {
                          ...config.theme,
                          fonts: { ...config.theme.fonts, primary: e.target.value },
                        },
                      });
                      setHasChanges(true);
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Open Sans">Open Sans</option>
                    <option value="Poppins">Poppins</option>
                    <option value="Montserrat">Montserrat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Heading Weight</label>
                  <select
                    value={config.theme.fonts.headingWeight}
                    onChange={(e) => {
                      setConfig({
                        ...config,
                        theme: {
                          ...config.theme,
                          fonts: { ...config.theme.fonts, headingWeight: parseInt(e.target.value) },
                        },
                      });
                      setHasChanges(true);
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="400">Normal (400)</option>
                    <option value="500">Medium (500)</option>
                    <option value="600">Semibold (600)</option>
                    <option value="700">Bold (700)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Border Radius</label>
                  <select
                    value={config.theme.borderRadius.medium}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setConfig({
                        ...config,
                        theme: {
                          ...config.theme,
                          borderRadius: { small: val / 2, medium: val, large: val * 2 },
                        },
                      });
                      setHasChanges(true);
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="4">Sharp (4px)</option>
                    <option value="8">Medium (8px)</option>
                    <option value="12">Rounded (12px)</option>
                    <option value="16">Very Rounded (16px)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Allowlist Tab */}
        {activeTab === 'allowlist' && config && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium text-white mb-2">Security Settings</h2>
              <p className="text-gray-400 text-sm">Configure allowed domains for your app</p>
            </div>

            {(['primary', 'payment', 'asset'] as const).map((type) => (
              <div key={type} className="space-y-3">
                <label className="block text-sm font-medium text-gray-300 capitalize">
                  {type === 'primary' ? 'Primary Domains (Store URLs)' :
                   type === 'payment' ? 'Payment Domains' : 'Asset/CDN Domains'}
                </label>
                <div className="space-y-2">
                  {config.allowlist[type].map((domain, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={domain}
                        onChange={(e) => {
                          const newList = [...config.allowlist[type]];
                          newList[index] = e.target.value;
                          updateAllowlist(type, newList);
                        }}
                        placeholder="example.com"
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => {
                          const newList = config.allowlist[type].filter((_, i) => i !== index);
                          updateAllowlist(type, newList);
                        }}
                        className="px-3 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      updateAllowlist(type, [...config.allowlist[type], '']);
                    }}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    + Add domain
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview Tab */}
        {activeTab === 'preview' && config && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-white mb-2">Configuration Preview</h2>
                <p className="text-gray-400 text-sm">JSON configuration that will be sent to your app</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(JSON.stringify(config, null, 2))}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Copy JSON
              </button>
            </div>

            <pre className="p-4 bg-gray-800 rounded-lg overflow-auto max-h-[500px] text-sm">
              <code className="text-gray-300">
                {JSON.stringify(config, null, 2)}
              </code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
