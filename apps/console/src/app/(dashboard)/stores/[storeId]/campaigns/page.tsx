'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/supabase/hooks';
import { Plus, Search, RefreshCw, Send, Calendar, Pencil, Trash2 } from 'lucide-react';
import { useDebounce, useCampaigns, useSegments } from '@/lib/hooks';
import { toast } from 'sonner';
import { campaignsApi, Campaign } from '@/lib/api-client';
import { CampaignForm, CampaignFormData } from '@/components/campaigns/campaign-form';
import { DeleteConfirmDialog } from '@/components/delete-confirm-dialog';

export default function CampaignsPage() {
  const params = useParams();
  const storeId = params.storeId as string;
  const { accessToken } = useAuth();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);

  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | undefined>(undefined);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | undefined>(undefined);

  const { data: campaigns = [], error: campaignsError, isLoading: loading, mutate: mutateCampaigns } = useCampaigns();
  const { data: segments = [] } = useSegments();

  const error = campaignsError ? (campaignsError instanceof Error ? campaignsError.message : 'Failed to load campaigns') : null;

  const filteredCampaigns = campaigns.filter((c) =>
    c.name.toLowerCase().includes(debouncedSearch.toLowerCase())
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

  const handleCreate = async (data: CampaignFormData) => {
    try {
      const created = await campaignsApi.create(accessToken!, storeId, {
        name: data.name,
        description: data.description || undefined,
        segment_id: data.segment_id || undefined,
        title: { en: data.title },
        body: { en: data.body },
      });
      if (data.scheduled_for) {
        await campaignsApi.schedule(
          accessToken!, storeId, created.id, new Date(data.scheduled_for).toISOString(),
        );
      }
      await mutateCampaigns();
      setShowForm(false);
      toast.success('Campaign created successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create campaign');
      throw err;
    }
  };

  const handleUpdate = async (data: CampaignFormData) => {
    if (!editingCampaign) return;
    try {
      await campaignsApi.update(
        accessToken!,
        storeId,
        editingCampaign.id,
        {
          name: data.name,
          description: data.description || undefined,
          segment_id: data.segment_id || undefined,
          title: data.title ? { en: data.title } : undefined,
          body: data.body ? { en: data.body } : undefined,
        },
      );
      if (data.scheduled_for) {
        await campaignsApi.schedule(
          accessToken!, storeId, editingCampaign.id, new Date(data.scheduled_for).toISOString(),
        );
      }
      await mutateCampaigns();
      setEditingCampaign(undefined);
      toast.success('Campaign updated successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update campaign');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deletingCampaign) return;
    try {
      await campaignsApi.delete(accessToken!, storeId, deletingCampaign.id);
      await mutateCampaigns();
      setDeletingCampaign(undefined);
      toast.success('Campaign deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete campaign');
      throw err;
    }
  };

  const openEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-gray-400 mt-1">Schedule and manage push notifications</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
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
          onClick={() => mutateCampaigns()}
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
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Actions</th>
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
                  {search
                    ? 'No campaigns match your search.'
                    : 'No campaigns yet. Create your first campaign to get started.'}
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
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(campaign)}
                        title={campaign.status === 'sent' ? 'View' : 'Edit'}
                        className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      {campaign.status !== 'sent' && (
                        <button
                          onClick={() => setDeletingCampaign(campaign)}
                          title="Delete"
                          className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showForm && (
        <CampaignForm
          segments={segments}
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Edit Modal */}
      {editingCampaign && (
        <CampaignForm
          campaign={editingCampaign}
          segments={segments}
          onSubmit={handleUpdate}
          onClose={() => setEditingCampaign(undefined)}
        />
      )}

      {/* Delete Confirmation */}
      {deletingCampaign && (
        <DeleteConfirmDialog
          title="Delete Campaign"
          description={`Are you sure you want to delete "${deletingCampaign.name}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onClose={() => setDeletingCampaign(undefined)}
        />
      )}
    </div>
  );
}
