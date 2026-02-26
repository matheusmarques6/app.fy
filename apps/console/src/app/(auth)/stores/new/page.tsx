'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/hooks';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { storesApi } from '../../../../lib/api-client';
import { useAppStore } from '../../../../lib/store';

export default function NewStorePage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const { setCurrentStore, setStores, stores } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    primary_domain: '',
    timezone: 'America/Sao_Paulo',
    platform: 'shopify',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const newStore = await storesApi.create(accessToken!, form);
      setStores([...stores, newStore]);
      setCurrentStore(newStore);
      router.push(`/stores/${newStore.id}/dashboard`);
    } catch (err: any) {
      const message =
        err.status === 409
          ? 'A store with this name already exists. Choose a different name.'
          : err.message || 'Failed to create store';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-xl mx-auto px-4 py-16">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Create a New Store</h1>
          <p className="text-gray-400">Set up your store to start building your mobile app</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Store Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="My Awesome Store"
              required
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Primary Domain
            </label>
            <input
              type="text"
              value={form.primary_domain}
              onChange={(e) => setForm({ ...form, primary_domain: e.target.value })}
              placeholder="mystore.com"
              required
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Your e-commerce store domain (without https://)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              E-commerce Platform
            </label>
            <select
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="shopify">Shopify</option>
              <option value="woocommerce">WooCommerce</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Timezone
            </label>
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="America/Sao_Paulo">America/Sao_Paulo (GMT-3)</option>
              <option value="America/New_York">America/New_York (GMT-5)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (GMT-8)</option>
              <option value="Europe/London">Europe/London (GMT+0)</option>
              <option value="Europe/Paris">Europe/Paris (GMT+1)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || !form.name || !form.primary_domain}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>Creating...</span>
              </>
            ) : (
              <span>Create Store</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
