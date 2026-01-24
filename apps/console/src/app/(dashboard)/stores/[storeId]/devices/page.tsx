'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Search, Filter, RefreshCw, Smartphone, Monitor } from 'lucide-react';
import { devicesApi, Device } from '@/lib/api-client';

export default function DevicesPage() {
  const params = useParams();
  const storeId = params.storeId as string;
  const { data: session } = useSession();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState<'ios' | 'android' | ''>('');
  const [stats, setStats] = useState<{
    total: number;
    by_platform: Record<string, number>;
    active_today: number;
    with_push_enabled: number;
    push_opt_in_rate: number;
  } | null>(null);

  const fetchDevices = async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const [devicesRes, statsRes] = await Promise.all([
        devicesApi.list(session.accessToken, storeId, {
          page,
          limit: 20,
          platform: platform || undefined,
          search: search || undefined,
        }),
        devicesApi.getStats(session.accessToken, storeId),
      ]);

      setDevices(devicesRes.data);
      setTotalPages(devicesRes.pagination.total_pages);
      setTotal(devicesRes.pagination.total);
      setStats(statsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [session, storeId, page, platform]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDevices();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Devices</h1>
          <p className="text-gray-400 mt-1">Manage app installs and push subscriptions</p>
        </div>
        <button
          onClick={fetchDevices}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Total Devices</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.total.toLocaleString()}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Active Today</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.active_today.toLocaleString()}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Push Enabled</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.with_push_enabled.toLocaleString()}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Push Opt-in Rate</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.push_opt_in_rate.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by fingerprint..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </form>
        <select
          value={platform}
          onChange={(e) => {
            setPlatform(e.target.value as 'ios' | 'android' | '');
            setPage(1);
          }}
          className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">All Platforms</option>
          <option value="ios">iOS</option>
          <option value="android">Android</option>
        </select>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Devices Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Device</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Platform</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Push</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Customer</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Last Seen</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Events</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                  Loading devices...
                </td>
              </tr>
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  No devices found. Devices will appear here once users install the app.
                </td>
              </tr>
            ) : (
              devices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {device.platform === 'ios' ? (
                        <Smartphone size={18} className="text-gray-400" />
                      ) : (
                        <Monitor size={18} className="text-gray-400" />
                      )}
                      <span className="text-white font-mono text-sm">
                        {device.device_fingerprint.slice(0, 12)}...
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      device.platform === 'ios'
                        ? 'bg-blue-900/50 text-blue-300'
                        : 'bg-green-900/50 text-green-300'
                    }`}>
                      {device.platform.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {device.push_subscriptions && device.push_subscriptions.length > 0 ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-900/50 text-green-300">
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-700 text-gray-400">
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {device.customer ? (
                      <span className="text-blue-400 text-sm">
                        {device.customer.external_customer_id || 'Linked'}
                      </span>
                    ) : (
                      <span className="text-gray-500 text-sm">Anonymous</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {formatDate(device.last_seen_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {device._count?.events || 0}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-sm text-gray-400">
              Showing {devices.length} of {total} devices
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
