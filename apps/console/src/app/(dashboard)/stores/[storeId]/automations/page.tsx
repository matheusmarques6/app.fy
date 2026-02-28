'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/supabase/hooks';
import { Plus, Search, Play, Pause, RefreshCw, Zap, Pencil, Trash2 } from 'lucide-react';
import { useDebounce, useAutomations } from '@/lib/hooks';
import { toast } from 'sonner';
import { automationsApi, Automation } from '@/lib/api-client';
import { AutomationForm, AutomationFormData, buildNodesAndEdges } from '@/components/automations/automation-form';
import { DeleteConfirmDialog } from '@/components/delete-confirm-dialog';

export default function AutomationsPage() {
  const params = useParams();
  const storeId = params.storeId as string;
  const { accessToken } = useAuth();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [toggling, setToggling] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | undefined>(undefined);
  const [deletingAutomation, setDeletingAutomation] = useState<Automation | undefined>(undefined);

  const { data: automations = [], error: automationsError, isLoading: loading, mutate: mutateAutomations } = useAutomations();

  const error = automationsError ? (automationsError instanceof Error ? automationsError.message : 'Failed to load automations') : null;

  const handleToggle = async (automation: Automation) => {
    if (!accessToken) return;

    const newActive = automation.status !== 'active';
    setToggling(automation.id);
    try {
      await automationsApi.toggle(accessToken, storeId, automation.id, newActive);
      await mutateAutomations();
      toast.success(newActive ? 'Automation activated' : 'Automation paused');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle automation');
    } finally {
      setToggling(null);
    }
  };

  const handleCreate = async (data: AutomationFormData) => {
    const { nodes, edges } = buildNodesAndEdges(data);
    try {
      await automationsApi.create(accessToken!, storeId, {
        name: data.name,
        description: data.description || undefined,
        entry_event: data.entry_event,
        nodes,
        edges,
      });
      await mutateAutomations();
      setShowForm(false);
      toast.success('Automation created successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create automation');
      throw err;
    }
  };

  const handleUpdate = async (data: AutomationFormData) => {
    if (!editingAutomation) return;
    const { nodes, edges } = buildNodesAndEdges(data);
    try {
      await automationsApi.update(accessToken!, storeId, editingAutomation.id, {
        name: data.name,
        description: data.description || undefined,
        entry_event: data.entry_event,
        nodes,
        edges,
      });
      await mutateAutomations();
      setEditingAutomation(undefined);
      toast.success('Automation updated successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update automation');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deletingAutomation) return;
    try {
      await automationsApi.delete(accessToken!, storeId, deletingAutomation.id);
      await mutateAutomations();
      setDeletingAutomation(undefined);
      toast.success('Automation deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete automation');
      throw err;
    }
  };

  const filteredAutomations = automations.filter((a) =>
    a.name.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-900/50 text-green-300';
      case 'paused':
        return 'bg-yellow-900/50 text-yellow-300';
      case 'draft':
        return 'bg-gray-700 text-gray-400';
      case 'archived':
        return 'bg-red-900/50 text-red-300';
      default:
        return 'bg-gray-700 text-gray-400';
    }
  };

  const getTriggerLabel = (event: string) => {
    const labels: Record<string, string> = {
      app_open: 'App Opened',
      first_purchase: 'First Purchase',
      add_to_cart: 'Added to Cart',
      cart_abandoned: 'Cart Abandoned',
      order_completed: 'Order Completed',
      app_install: 'App Installed',
    };
    return labels[event] || event;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Automations</h1>
          <p className="text-gray-400 mt-1">Create automated workflows triggered by user actions</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus size={20} />
          <span>New Automation</span>
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search automations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => mutateAutomations()}
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

      {/* Automations Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-gray-400" size={32} />
        </div>
      ) : filteredAutomations.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-lg p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
            <Zap className="text-gray-500" size={24} />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            {search ? 'No automations match your search' : 'No automations yet'}
          </h3>
          <p className="text-gray-400 mb-4">
            Create your first automation to engage users automatically
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAutomations.map((automation) => (
            <div
              key={automation.id}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-white font-medium truncate">{automation.name}</h3>
                  {automation.description && (
                    <p className="text-sm text-gray-400 mt-1 truncate">{automation.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <button
                    onClick={() => setEditingAutomation(automation)}
                    title="Edit"
                    className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeletingAutomation(automation)}
                    title="Delete"
                    className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className="text-yellow-400" />
                <span className="text-sm text-gray-400">{getTriggerLabel(automation.entry_event)}</span>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
                <span>{automation._count?.runs ?? 0} runs</span>
                {automation.stats?.total_deliveries !== undefined && (
                  <span>{Number(automation.stats.total_deliveries)} pushes sent</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(automation.status)}`}>
                  {automation.status}
                </span>
                <button
                  onClick={() => handleToggle(automation)}
                  disabled={toggling === automation.id}
                  className={`p-2 rounded-lg transition-colors ${
                    automation.status === 'active'
                      ? 'bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400'
                      : 'bg-green-900/30 hover:bg-green-900/50 text-green-400'
                  } disabled:opacity-50`}
                >
                  {toggling === automation.id ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : automation.status === 'active' ? (
                    <Pause size={16} />
                  ) : (
                    <Play size={16} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <AutomationForm
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Edit Modal */}
      {editingAutomation && (
        <AutomationForm
          automation={editingAutomation}
          onSubmit={handleUpdate}
          onClose={() => setEditingAutomation(undefined)}
        />
      )}

      {/* Delete Confirmation */}
      {deletingAutomation && (
        <DeleteConfirmDialog
          title="Delete Automation"
          description={`Are you sure you want to delete "${deletingAutomation.name}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onClose={() => setDeletingAutomation(undefined)}
        />
      )}
    </div>
  );
}
