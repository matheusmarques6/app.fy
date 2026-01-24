'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plus, Search, Users, RefreshCw, MoreVertical } from 'lucide-react';
import { segmentsApi, Segment } from '@/lib/api-client';

export default function SegmentsPage() {
  const params = useParams();
  const storeId = params.storeId as string;
  const { data: session } = useSession();

  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchSegments = async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const data = await segmentsApi.list(session.accessToken, storeId);
      setSegments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load segments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSegments();
  }, [session, storeId]);

  const filteredSegments = segments.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-900/50 text-green-300';
      case 'computing':
        return 'bg-yellow-900/50 text-yellow-300';
      default:
        return 'bg-gray-700 text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Segments</h1>
          <p className="text-gray-400 mt-1">Create dynamic user segments for targeted messaging</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
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
          onClick={fetchSegments}
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
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Members</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Created</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                  Loading segments...
                </td>
              </tr>
            ) : filteredSegments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
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
                    {segment.type}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Users size={14} className="text-gray-400" />
                      <span className="text-white">{segment.device_count.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(segment.status)}`}>
                      {segment.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {formatDate(segment.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
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
