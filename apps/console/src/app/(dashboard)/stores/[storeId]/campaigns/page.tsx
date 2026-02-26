'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/supabase/hooks';
import { Plus, Search, RefreshCw, Send, Calendar, MoreVertical } from 'lucide-react';
import { campaignsApi, Campaign } from '@/lib/api-client';

export default function CampaignsPage() {
  const params = useParams();
  const storeId = params.storeId as string;
  const { accessToken } = useAuth();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchCampaigns = async () => {
    if (!accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const data = await campaignsApi.list(accessToken!, storeId);
      setCampaigns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [accessToken, storeId]);

  const filteredCampaigns = campaigns.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-900/50 text-green-300';
      case 'scheduled':
        return 'bg-blue-900/50 text-blue-300';
      case 'sending':
        return 'bg-yellow-900/50 text-yellow-300';
      case 'draft':
        return 'bg-gray-700 text-gray-400';
      case 'cancelled':
        return 'bg-red-900/50 text-red-300';
      default:
        return 'bg-gray-700 text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-gray-400 mt-1">Schedule and manage push notifications</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
          <Plus size={20} />
          <span>New Campaign</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={fetchCampaigns}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Campaigns Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Scheduled</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Sent</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                  Loading campaigns...
                </td>
              </tr>
            ) : filteredCampaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  {search ? 'No campaigns match your search.' : 'No campaigns yet. Create your first campaign to get started.'}
                </td>
              </tr>
            ) : (
              filteredCampaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-white font-medium">{campaign.name}</span>
                      {campaign.description && (
                        <p className="text-gray-500 text-xs mt-1 truncate max-w-xs">
                          {campaign.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {campaign.type}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {campaign.scheduled_for ? (
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        {formatDate(campaign.scheduled_for)}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {campaign.sent_at ? (
                      <div className="flex items-center gap-1">
                        <Send size={14} className="text-green-400" />
                        {formatDate(campaign.sent_at)}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <button className="p-1 hover:bg-gray-700 rounded">
                      <MoreVertical size={18} className="text-gray-400" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
