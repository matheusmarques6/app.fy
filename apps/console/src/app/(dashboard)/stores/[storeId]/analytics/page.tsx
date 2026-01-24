'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { analyticsApi, AnalyticsOverview, PushStats } from '@/lib/api-client';

interface EventStats {
  total: number;
  by_type: Array<{ name: string; count: number; percentage: number }>;
}

interface RevenueAttribution {
  total_revenue_minor: number;
  attributed_revenue_minor: number;
  attribution_rate: number;
  by_model: Array<{ model: string; orders: number; revenue_minor: number }>;
}

export default function AnalyticsPage() {
  const params = useParams();
  const storeId = params.storeId as string;
  const { data: session } = useSession();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [pushStats, setPushStats] = useState<PushStats | null>(null);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const [revenueAttribution, setRevenueAttribution] = useState<RevenueAttribution | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  const fetchData = async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const days = dateRange === '7d' ? 7 : dateRange === '90d' ? 90 : 30;
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      const fromStr = fromDate.toISOString();

      const [overviewRes, pushRes, eventsRes, revenueRes] = await Promise.all([
        analyticsApi.getOverview(session.accessToken, storeId),
        analyticsApi.getPushStats(session.accessToken, storeId, fromStr),
        analyticsApi.getEventStats(session.accessToken, storeId, fromStr),
        analyticsApi.getRevenueAttribution(session.accessToken, storeId, fromStr),
      ]);

      setOverview(overviewRes);
      setPushStats(pushRes);
      setEventStats(eventsRes);
      setRevenueAttribution(revenueRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [session, storeId, dateRange]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatCurrency = (minor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(minor / 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 mt-1">Track performance and user engagement</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-800 rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  dateRange === range
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Total Devices</div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-white">
              {overview ? formatNumber(overview.devices.total) : '-'}
            </span>
            {overview && overview.devices.new > 0 && (
              <span className="flex items-center text-sm text-green-400">
                <TrendingUp size={16} />
                <span className="ml-1">+{formatNumber(overview.devices.new)} new</span>
              </span>
            )}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Active Devices</div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-white">
              {overview ? formatNumber(overview.devices.active) : '-'}
            </span>
            {overview && (
              <span className="text-sm text-gray-500">
                {Math.round((overview.devices.active / overview.devices.total) * 100)}% of total
              </span>
            )}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Push Open Rate</div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-white">
              {pushStats ? `${pushStats.rates.open}%` : '-'}
            </span>
            {pushStats && (
              <span className="text-sm text-gray-500">
                {formatNumber(pushStats.opened)} opened
              </span>
            )}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Revenue</div>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-white">
              {overview ? formatCurrency(overview.orders.revenue_minor) : '-'}
            </span>
            {overview && (
              <span className="text-sm text-gray-500">
                {formatNumber(overview.orders.total)} orders
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Charts & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Push Performance */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Push Performance</h3>
          {pushStats ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Sent</span>
                <span className="text-white font-medium">{formatNumber(pushStats.sent)}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '100%' }} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Delivered</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{formatNumber(pushStats.delivered)}</span>
                  <span className="text-xs text-green-400">{pushStats.rates.delivery}%</span>
                </div>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${pushStats.rates.delivery}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Opened</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{formatNumber(pushStats.opened)}</span>
                  <span className="text-xs text-blue-400">{pushStats.rates.open}%</span>
                </div>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full"
                  style={{ width: `${pushStats.rates.open}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Clicked</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{formatNumber(pushStats.clicked)}</span>
                  <span className="text-xs text-yellow-400">{pushStats.rates.click}%</span>
                </div>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full"
                  style={{ width: `${pushStats.rates.click}%` }}
                />
              </div>

              {pushStats.failed > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Failed</span>
                    <span className="text-red-400 font-medium">{formatNumber(pushStats.failed)}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${(pushStats.failed / pushStats.sent) * 100}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              No push data available
            </div>
          )}
        </div>

        {/* Revenue Attribution */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Revenue Attribution</h3>
          {revenueAttribution ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Total Revenue</div>
                  <div className="text-xl font-bold text-white">
                    {formatCurrency(revenueAttribution.total_revenue_minor)}
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Attributed Revenue</div>
                  <div className="text-xl font-bold text-green-400">
                    {formatCurrency(revenueAttribution.attributed_revenue_minor)}
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Attribution Rate</span>
                  <span className="text-green-400 font-medium">{revenueAttribution.attribution_rate}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${revenueAttribution.attribution_rate}%` }}
                  />
                </div>
              </div>

              {revenueAttribution.by_model && revenueAttribution.by_model.length > 0 && (
                <div className="pt-4 border-t border-gray-700">
                  <h4 className="text-sm font-medium text-gray-300 mb-3">By Attribution Model</h4>
                  <div className="space-y-2">
                    {revenueAttribution.by_model.map((model: { model: string; orders: number; revenue_minor: number }, index: number) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">{model.model}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">{model.orders} orders</span>
                          <span className="text-sm text-white">{formatCurrency(model.revenue_minor)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              No revenue data available
            </div>
          )}
        </div>

        {/* Device Stats */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Device Statistics</h3>
          {overview ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Total Devices</span>
                <span className="text-white font-medium">{formatNumber(overview.devices.total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Active (30d)</span>
                <span className="text-white font-medium">{formatNumber(overview.devices.active)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">New (30d)</span>
                <span className="text-green-400 font-medium">+{formatNumber(overview.devices.new)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Push Subscribers</span>
                <span className="text-white font-medium">{formatNumber(overview.devices.push_subscribers)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Push Opt-in Rate</span>
                <span className="text-white font-medium">{overview.devices.push_rate}%</span>
              </div>

              <div className="pt-4 border-t border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Opt-in Progress</span>
                  <span className="text-sm text-gray-400">{overview.devices.push_rate}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full"
                    style={{ width: `${overview.devices.push_rate}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              No device data available
            </div>
          )}
        </div>

        {/* Top Events */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Top Events</h3>
          {eventStats && eventStats.by_type && eventStats.by_type.length > 0 ? (
            <div className="space-y-3">
              {eventStats.by_type.map((event: { name: string; count: number; percentage: number }, index: number) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <span className="text-sm text-gray-300 font-mono">{event.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{formatNumber(event.count)}</span>
                    <span className="text-xs text-gray-500">({event.percentage}%)</span>
                  </div>
                </div>
              ))}
              <div className="pt-2 text-sm text-gray-500">
                Total events: {formatNumber(eventStats.total)}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              No event data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
