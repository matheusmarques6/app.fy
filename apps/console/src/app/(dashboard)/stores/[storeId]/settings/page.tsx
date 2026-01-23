'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Save, Key, Globe, Bell, Shield } from 'lucide-react';

type Tab = 'general' | 'integrations' | 'push' | 'security';

export default function SettingsPage() {
  const { currentStore } = useAppStore();
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const tabs = [
    { id: 'general' as Tab, name: 'General', icon: Globe },
    { id: 'integrations' as Tab, name: 'Integrations', icon: Key },
    { id: 'push' as Tab, name: 'Push Settings', icon: Bell },
    { id: 'security' as Tab, name: 'Security', icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your store configuration</p>
      </div>

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
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">Store Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Store Name</label>
                <input
                  type="text"
                  defaultValue={currentStore?.name}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Primary Domain</label>
                <input
                  type="text"
                  defaultValue={currentStore?.primary_domain}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Timezone</label>
                <select className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500">
                  <option>America/Sao_Paulo</option>
                  <option>America/New_York</option>
                  <option>Europe/London</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                <Save size={18} />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">E-commerce Platform</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { name: 'Shopify', connected: false },
                { name: 'WooCommerce', connected: false },
              ].map((platform) => (
                <div key={platform.name} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                  <span className="text-white font-medium">{platform.name}</span>
                  <button className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">
                    Connect
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">API Keys</h3>
            <p className="text-gray-400 mb-4">Use these keys to integrate with our SDK and APIs.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Public Key</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value="pk_live_xxxxxxxxxxxxx"
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 font-mono text-sm"
                  />
                  <button className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
                    Copy
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Secret Key</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    readOnly
                    value="sk_live_xxxxxxxxxxxxx"
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 font-mono text-sm"
                  />
                  <button className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
                    Reveal
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Push Settings Tab */}
      {activeTab === 'push' && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">OneSignal Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">App ID</label>
                <input
                  type="text"
                  placeholder="Enter your OneSignal App ID"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">REST API Key</label>
                <input
                  type="password"
                  placeholder="Enter your OneSignal REST API Key"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                <Save size={18} />
                <span>Save Configuration</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">Webhook Security</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Webhook Signing Secret</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    readOnly
                    value="whsec_xxxxxxxxxxxxx"
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 font-mono text-sm"
                  />
                  <button className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
                    Regenerate
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Use this secret to verify webhook signatures from your e-commerce platform.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">Allowed Origins (CORS)</h3>
            <textarea
              placeholder="https://mystore.com&#10;https://www.mystore.com"
              rows={4}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              One origin per line. Leave empty to allow all origins.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
