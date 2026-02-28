'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/supabase/hooks';
import { Plus, Search, Users, RefreshCw, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useDebounce, useSegments } from '@/lib/hooks';
import { toast } from 'sonner';
import { segmentsApi, Segment } from '@/lib/api-client';
import { SegmentForm, SegmentFormData } from '@/components/segments/segment-form';
import { DeleteConfirmDialog } from '@/components/delete-confirm-dialog';

export default function SegmentsPage() {
  const params = useParams();
  const storeId = params.storeId as string;
  const { accessToken } = useAuth();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);

  const [showForm, setShowForm] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | undefined>(undefined);
  const [deletingSegment, setDeletingSegment] = useState<Segment | undefined>(undefined);

  const { data: segments = [], error: segmentsError, isLoading: loading, mutate: mutateSegments } = useSegments();

  const error = segmentsError ? (segmentsError instanceof Error ? segmentsError.message : 'Failed to load segments') : null;

  const filteredSegments = segments.filter((s) =>
    s.name.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const handleCreate = async (data: SegmentFormData) => {
    try {
      await segmentsApi.create(accessToken!, storeId, {
        name: data.name,
        description: data.description || undefined,
        definition: data.definition,
      });
      await mutateSegments();
      setShowForm(false);
      toast.success('Segment created successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create segment');
      throw err;
    }
  };

  const handleUpdate = async (data: SegmentFormData) => {
    if (!editingSegment) return;
    try {
      await segmentsApi.update(accessToken!, storeId, editingSegment.id, {
        name: data.name,
        description: data.description || undefined,
        definition: data.definition,
      });
      await mutateSegments();
      setEditingSegment(undefined);
      toast.success('Segment updated successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update segment');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deletingSegment) return;
    try {
      await segmentsApi.delete(accessToken!, storeId, deletingSegment.id);
      await mutateSegments();
      setDeletingSegment(undefined);
      toast.success('Segment deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete segment');
      throw err;
    }
  };

  const isCalculating = (segment: Segment) => {
    if (segment.last_evaluated_at) return false;
    const age = Date.now() - new Date(segment.created_at).getTime();
    return age < 60_000;
  };

  const getRulesSummary = (segment: Segment) => {
    const count = segment.definition?.rules?.length ?? 0;
    const match = segment.definition?.match === 'any' ? 'OR' : 'AND';
    return `${count} rule${count !== 1 ? 's' : ''} (${match})`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Segments</h1>
          <p className="text-gray-400 mt-1">Create dynamic user segments for targeted messaging</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus size={20} />
          <span>New Segment</span>
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search segments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => mutateSegments()}
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

      {/* Segments Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Rules</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Members</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Created</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                  <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                  Loading segments...
                </td>
              </tr>
            ) : filteredSegments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                    <Users className="text-gray-500" size={24} />
                  </div>
                  <p>{search ? 'No segments match your search.' : 'No segments yet. Create your first segment to target users.'}</p>
                </td>
              </tr>
            ) : (
              filteredSegments.map((segment) => (
                <tr key={segment.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-white font-medium">{segment.name}</span>
                      {segment.description && (
                        <p className="text-gray-500 text-xs mt-1 truncate max-w-xs">
                          {segment.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {getRulesSummary(segment)}
                  </td>
                  <td className="px-4 py-3">
                    {isCalculating(segment) ? (
                      <div className="flex items-center gap-1 text-yellow-500">
                        <Loader2 size={14} className="animate-spin" />
                        <span className="text-xs">Calculating...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Users size={14} className="text-gray-400" />
                        <span className="text-white">{segment.member_count.toLocaleString()}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {formatDate(segment.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingSegment(segment)}
                        title="Edit"
                        className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeletingSegment(segment)}
                        title="Delete"
                        className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showForm && accessToken && (
        <SegmentForm
          accessToken={accessToken}
          storeId={storeId}
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Edit Modal */}
      {editingSegment && accessToken && (
        <SegmentForm
          segment={editingSegment}
          accessToken={accessToken}
          storeId={storeId}
          onSubmit={handleUpdate}
          onClose={() => setEditingSegment(undefined)}
        />
      )}

      {/* Delete Confirmation */}
      {deletingSegment && (
        <DeleteConfirmDialog
          title="Delete Segment"
          description={`Are you sure you want to delete "${deletingSegment.name}"? All memberships will be removed. This action cannot be undone.`}
          onConfirm={handleDelete}
          onClose={() => setDeletingSegment(undefined)}
        />
      )}
    </div>
  );
}
