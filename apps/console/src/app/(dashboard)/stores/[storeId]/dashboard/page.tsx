'use client';

import { useParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Bell, Users, Smartphone, TrendingUp, RefreshCw } from 'lucide-react';
import { useAnalyticsOverview, usePushStats, useCampaigns } from '@/lib/hooks';

export default function DashboardPage() {
  const params = useParams();
  const storeId = params.storeId as string;
  const { currentStore } = useAppStore();

  const { data: overview, error: overviewError, isLoading: overviewLoading, mutate: mutateOverview } = useAnalyticsOverview();
  const { data: pushStats, mutate: mutatePush } = usePushStats();
  const { data: campaigns = [], mutate: mutateCampaigns } = useCampaigns();

  const recentCampaigns = campaigns.slice(0, 5);
  const loading = overviewLoading;
  const error = overviewError ? (overviewError instanceof Error ? overviewError.message : 'Failed to load dashboard') : null;

  const refreshAll = () => {
    mutateOverview();
    mutatePush();
    mutateCampaigns();
  };

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
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
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">
            Overview for {currentStore?.name || 'your store'}
          </p>
        </div>
        <button
          onClick={refreshAll}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
        >
          <RefreshCw size={18} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <Smartphone className="text-blue-400" size={20} />
            {overview && overview.devices.new > 0 && (
              <span className="text-xs text-green-400">+{overview.devices.new} new</span>
            )}
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">
              {overview ? formatNumber(overview.devices.total) : '-'}
            </div>
            <div className="text-sm text-gray-400">Total Devices</div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <Bell className="text-purple-400" size={20} />
            {pushStats && (
              <span className="text-xs text-gray-400">{pushStats.rates.open}% open rate</span>
            )}
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">
              {pushStats ? formatNumber(pushStats.sent) : '-'}
            </div>
            <div className="text-sm text-gray-400">Push Sent (30d)</div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <Users className="text-green-400" size={20} />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">
              {overview ? formatNumber(overview.devices.push_subscribers) : '-'}
            </div>
            <div className="text-sm text-gray-400">Push Subscribers</div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <TrendingUp className="text-yellow-400" size={20} />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">
              {overview ? formatCurrency(overview.orders.revenue_minor) : '-'}
            </div>
            <div className="text-sm text-gray-400">Revenue (30d)</div>
          </div>
        </div>
      </div>

      {/* Push Performance and Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Push Performance</h3>
          {pushStats ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Sent</span>
                <span className="text-white font-medium">{formatNumber(pushStats.sent)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Delivered</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{formatNumber(pushStats.delivered)}</span>
                  <span className="text-xs text-green-400">{pushStats.rates.delivery}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Opened</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{formatNumber(pushStats.opened)}</span>
                  <span className="text-xs text-blue-400">{pushStats.rates.open}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Clicked</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{formatNumber(pushStats.clicked)}</span>
                  <span className="text-xs text-purple-400">{pushStats.rates.click}%</span>
                </div>
              </div>
              {pushStats.failed > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Failed</span>
                  <span className="text-red-400 font-medium">{formatNumber(pushStats.failed)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              No push data yet
            </div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Device Stats</h3>
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
                <span className="text-gray-400">Push Opt-in Rate</span>
                <span className="text-white font-medium">{overview.devices.push_rate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Total Orders</span>
                <span className="text-white font-medium">{formatNumber(overview.orders.total)}</span>
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500">
              No device data yet
            </div>
          )}
        </div>
      </div>

      {/* Recent Campaigns */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-white mb-4">Recent Campaigns</h3>
        {recentCampaigns.length > 0 ? (
          <div className="space-y-3">
            {recentCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    campaign.status === 'sent' ? 'bg-green-500' :
                    campaign.status === 'scheduled' ? 'bg-blue-500' :
                    campaign.status === 'draft' ? 'bg-gray-500' :
                    'bg-yellow-500'
                  }`} />
                  <div>
                    <span className="text-sm text-gray-300">{campaign.name}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                      campaign.status === 'sent' ? 'bg-green-900/50 text-green-300' :
                      campaign.status === 'scheduled' ? 'bg-blue-900/50 text-blue-300' :
                      'bg-gray-700 text-gray-400'
                    }`}>
                      {campaign.status}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {campaign.sent_at ? formatDate(campaign.sent_at) :
                   campaign.scheduled_for ? `Scheduled ${formatDate(campaign.scheduled_for)}` :
                   'Draft'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">
            No campaigns yet. Create your first campaign to get started.
          </div>
        )}
      </div>
    </div>
  );
}
